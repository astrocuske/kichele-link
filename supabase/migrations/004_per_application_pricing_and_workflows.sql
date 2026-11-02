-- Kichele Link migration 004: per-application pricing and atomic workflows.
--
-- Canonical model shared by the frontend, the Edge Functions and the
-- payment-security helpers:
--   * Each accepted application stores its own agreed_price.
--   * Every payment transaction references one application_id.
--   * Posters pay per accepted application through the mpesa-stk-push
--     Edge Function; mpesa-callback confirms and reconciles by application_id.
--
-- IMPORTANT:
--   * This migration targets the audited LIVE schema (bigint identity IDs,
--     see supabase/audit/live_schema_20261030.sql).
--   * It does not rewrite migration 001 or reset existing data.
--   * Review and test against a disposable/local database before applying remotely.

begin;

-- ---------------------------------------------------------------------------
-- 1. Add per-application agreed pricing and payment linkage.
-- ---------------------------------------------------------------------------
alter table public.applications
    add column if not exists agreed_price numeric;

alter table public.payment_transactions
    add column if not exists application_id bigint;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'applications_agreed_price_check'
          and conrelid = 'public.applications'::regclass
    ) then
        alter table public.applications
            add constraint applications_agreed_price_check
            check (
                agreed_price is null
                or (
                    agreed_price = floor(agreed_price)
                    and agreed_price between 1 and 1000000
                )
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'payment_transactions_application_id_fkey'
          and conrelid = 'public.payment_transactions'::regclass
    ) then
        alter table public.payment_transactions
            add constraint payment_transactions_application_id_fkey
            foreign key (application_id)
            references public.applications(id)
            on delete restrict;
    end if;
end;
$$;

create unique index if not exists payment_transactions_application_id_unique
    on public.payment_transactions (application_id)
    where application_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Remove permissive/legacy policies and rebuild least-privilege policies.
-- ---------------------------------------------------------------------------
do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('gigs', 'applications', 'payment_transactions', 'profiles')
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            policy_row.policyname,
            policy_row.schemaname,
            policy_row.tablename
        );
    end loop;
end;
$$;

-- The view exposes only names and user IDs. It is intentionally a
-- security-definer view (the PostgreSQL 15 default), not security_invoker,
-- because clients have no direct SELECT privilege on profiles.
create or replace view public.public_profile
with (security_barrier = true)
as
select p.user_id, p.full_name
from public.profiles p
where p.user_id is not null;

revoke all on public.public_profile from public, anon;
grant select on public.public_profile to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Harden the helper used by the gigs SELECT policy.
-- ---------------------------------------------------------------------------
create or replace function public.worker_has_accepted_application(gig_id_input bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select auth.uid() is not null
       and exists (
            select 1
            from public.applications a
            where a.gig_id = gig_id_input
              and a.worker_id = auth.uid()
              and a.status = 'accepted'
       );
$$;

revoke all on function public.worker_has_accepted_application(bigint) from public, anon;
grant execute on function public.worker_has_accepted_application(bigint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Protect direct inserts into gigs and applications.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_gig_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication is required to post a gig.'
            using errcode = '42501';
    end if;

    new.poster_id := auth.uid();
    new.status := 'open';
    new.agreed_price := null;
    new.payment_status := 'unpaid';

    if length(btrim(coalesce(new.title, ''))) = 0
       or length(new.title) > 120 then
        raise exception 'Gig title is required and must be 120 characters or fewer.'
            using errcode = '23514';
    end if;

    if length(btrim(coalesce(new.description, ''))) = 0
       or length(new.description) > 5000 then
        raise exception 'Gig description is required and must be 5000 characters or fewer.'
            using errcode = '23514';
    end if;

    if new.budget is not null and (new.budget < 0 or new.budget > 1000000) then
        raise exception 'Gig budget must be between KES 0 and KES 1,000,000.'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

drop trigger if exists gigs_enforce_insert on public.gigs;
create trigger gigs_enforce_insert
before insert on public.gigs
for each row
execute function public.enforce_gig_insert();

create or replace function public.enforce_application_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    gig_poster uuid;
    gig_status text;
begin
    if auth.uid() is null then
        raise exception 'Authentication is required to apply.'
            using errcode = '42501';
    end if;

    select g.poster_id, g.status
      into gig_poster, gig_status
    from public.gigs g
    where g.id = new.gig_id
    for share;

    if not found then
        raise exception 'Gig not found.'
            using errcode = 'P0002';
    end if;

    if gig_poster = auth.uid() then
        raise exception 'You cannot apply to your own gig.'
            using errcode = '23514';
    end if;

    if gig_status <> 'open' then
        raise exception 'Applications can only be submitted to open gigs.'
            using errcode = '23514';
    end if;

    if new.message is not null and length(new.message) > 2000 then
        raise exception 'Application message must be 2000 characters or fewer.'
            using errcode = '22001';
    end if;

    new.worker_id := auth.uid();
    new.status := 'pending';
    new.agreed_price := null;
    return new;
end;
$$;

drop trigger if exists applications_enforce_rules on public.applications;
drop trigger if exists applications_enforce_insert on public.applications;
drop function if exists public.enforce_application_rules();
create trigger applications_enforce_insert
before insert on public.applications
for each row
execute function public.enforce_application_insert();

-- Preserve the legacy gig-level price as the initial agreed price for
-- existing accepted applications. This runs after the restrictive
-- applications trigger above has been replaced, because the previous
-- guard only allowed status transitions from pending. New acceptances
-- always store the price per application from here on.
update public.applications a
set agreed_price = g.agreed_price
from public.gigs g
where g.id = a.gig_id
  and a.status = 'accepted'
  and a.agreed_price is null
  and g.agreed_price is not null;

-- ---------------------------------------------------------------------------
-- 5. Profile RPCs: a signed-in user can read/update only their own private data.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_profile()
returns table (
    full_name text,
    phone text,
    location text
)
language sql
stable
security definer
set search_path = ''
as $$
    select p.full_name, p.phone, p.location
    from public.profiles p
    where auth.uid() is not null
      and p.user_id = auth.uid();
$$;

create or replace function public.upsert_my_profile(
    p_full_name text,
    p_phone text,
    p_location text
)
returns table (
    full_name text,
    phone text,
    location text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    p_full_name := btrim(coalesce(p_full_name, ''));
    p_phone := btrim(coalesce(p_phone, ''));
    p_location := btrim(coalesce(p_location, ''));

    if p_full_name = '' or length(p_full_name) > 100 then
        raise exception 'Full name is required and must be 100 characters or fewer.'
            using errcode = '23514';
    end if;

    if length(p_phone) > 20 then
        raise exception 'Phone number must be 20 characters or fewer.'
            using errcode = '22001';
    end if;

    if length(p_location) > 100 then
        raise exception 'Location must be 100 characters or fewer.'
            using errcode = '22001';
    end if;

    insert into public.profiles as existing_profile
        (user_id, full_name, phone, location)
    values
        (current_user_id, p_full_name, nullif(p_phone, ''), nullif(p_location, ''))
    on conflict (user_id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        location = excluded.location
    where existing_profile.user_id = current_user_id;

    return query
    select p.full_name, p.phone, p.location
    from public.profiles p
    where p.user_id = current_user_id;
end;
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.upsert_my_profile(text, text, text) from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.upsert_my_profile(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Atomic workflow RPCs. Direct client UPDATE/DELETE is revoked below.
-- ---------------------------------------------------------------------------
-- Remove the old payment trigger that forced every update back to pending.
-- Payment status changes are reserved for the trusted server-side callback.
drop trigger if exists payment_transactions_enforce_rules on public.payment_transactions;
drop function if exists public.enforce_payment_transaction_rules();
drop function if exists public.request_role();

create or replace function public.accept_application(
    p_application_id bigint,
    p_agreed_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_application public.applications%rowtype;
    selected_gig public.gigs%rowtype;
    new_payment_id bigint;
    has_prior_acceptance boolean;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    if p_agreed_price is null
       or p_agreed_price <> floor(p_agreed_price)
       or p_agreed_price < 1
       or p_agreed_price > 1000000 then
        raise exception 'Agreed price must be a whole number between KES 1 and KES 1,000,000.'
            using errcode = '23514';
    end if;

    select *
      into selected_application
    from public.applications a
    where a.id = p_application_id
    for update;

    if not found then
        raise exception 'Application not found.'
            using errcode = 'P0002';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = selected_application.gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'You are not allowed to accept this application.'
            using errcode = '42501';
    end if;

    if selected_application.status <> 'pending' then
        raise exception 'This application is no longer pending.'
            using errcode = '23514';
    end if;

    if selected_application.worker_id = current_user_id then
        raise exception 'A gig poster cannot accept their own application.'
            using errcode = '23514';
    end if;

    select exists (
        select 1
        from public.applications a
        where a.gig_id = selected_gig.id
          and a.status = 'accepted'
    ) into has_prior_acceptance;

    if selected_gig.status <> 'open'
       and not (selected_gig.status = 'closed' and has_prior_acceptance) then
        raise exception 'This gig is not accepting another worker.'
            using errcode = '23514';
    end if;

    update public.applications
    set status = 'accepted',
        agreed_price = p_agreed_price
    where id = selected_application.id;

    insert into public.payment_transactions (
        application_id,
        gig_id,
        payer_id,
        worker_id,
        amount,
        status
    )
    values (
        selected_application.id,
        selected_gig.id,
        current_user_id,
        selected_application.worker_id,
        p_agreed_price,
        'pending'
    )
    returning id into new_payment_id;

    update public.gigs
    set status = 'closed'
    where id = selected_gig.id;

    return jsonb_build_object(
        'application_id', selected_application.id,
        'gig_id', selected_gig.id,
        'worker_id', selected_application.worker_id,
        'agreed_price', p_agreed_price,
        'payment_transaction_id', new_payment_id,
        'gig_status', 'closed'
    );
end;
$$;

create or replace function public.reject_application(p_application_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_application public.applications%rowtype;
    selected_gig public.gigs%rowtype;
    has_prior_acceptance boolean;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    select *
      into selected_application
    from public.applications a
    where a.id = p_application_id
    for update;

    if not found then
        raise exception 'Application not found.'
            using errcode = 'P0002';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = selected_application.gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'You are not allowed to reject this application.'
            using errcode = '42501';
    end if;

    if selected_application.status <> 'pending' then
        raise exception 'This application is no longer pending.'
            using errcode = '23514';
    end if;

    select exists (
        select 1 from public.applications a
        where a.gig_id = selected_gig.id
          and a.status = 'accepted'
    ) into has_prior_acceptance;

    if selected_gig.status not in ('open', 'closed')
       or (selected_gig.status = 'closed' and not has_prior_acceptance) then
        raise exception 'This application can no longer be changed.'
            using errcode = '23514';
    end if;

    update public.applications
    set status = 'rejected'
    where id = selected_application.id;

    return true;
end;
$$;

create or replace function public.set_gig_status(
    p_gig_id bigint,
    p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_gig public.gigs%rowtype;
    has_acceptance boolean;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    if p_status not in ('open', 'closed') then
        raise exception 'Only open or closed status can be selected here.'
            using errcode = '23514';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = p_gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'Gig not found or you are not its poster.'
            using errcode = '42501';
    end if;

    if selected_gig.status not in ('open', 'closed') then
        raise exception 'This gig can no longer be reopened or closed.'
            using errcode = '23514';
    end if;

    select exists (
        select 1 from public.applications a
        where a.gig_id = selected_gig.id
          and a.status = 'accepted'
    ) into has_acceptance;

    if has_acceptance and p_status = 'open' then
        raise exception 'A gig with an accepted worker cannot be reopened.'
            using errcode = '23514';
    end if;

    update public.gigs
    set status = p_status
    where id = selected_gig.id;

    return true;
end;
$$;

create or replace function public.complete_gig(p_gig_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_gig public.gigs%rowtype;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = p_gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'Gig not found or you are not its poster.'
            using errcode = '42501';
    end if;

    if selected_gig.status <> 'closed'
       or not exists (
            select 1 from public.applications a
            where a.gig_id = selected_gig.id
              and a.status = 'accepted'
       ) then
        raise exception 'Only a closed gig with at least one accepted worker can be completed.'
            using errcode = '23514';
    end if;

    update public.gigs
    set status = 'completed'
    where id = selected_gig.id;

    return true;
end;
$$;

create or replace function public.cancel_gig(p_gig_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_gig public.gigs%rowtype;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = p_gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'Gig not found or you are not its poster.'
            using errcode = '42501';
    end if;

    if selected_gig.status not in ('open', 'closed')
       or exists (
            select 1 from public.applications a
            where a.gig_id = selected_gig.id
              and a.status = 'accepted'
       ) then
        raise exception 'A gig with accepted work or a final status cannot be cancelled.'
            using errcode = '23514';
    end if;

    update public.gigs
    set status = 'cancelled'
    where id = selected_gig.id;

    return true;
end;
$$;

create or replace function public.update_gig(
    p_gig_id bigint,
    p_title text,
    p_description text,
    p_category text,
    p_location text,
    p_budget numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    selected_gig public.gigs%rowtype;
begin
    if current_user_id is null then
        raise exception 'Authentication is required.'
            using errcode = '42501';
    end if;

    select *
      into selected_gig
    from public.gigs g
    where g.id = p_gig_id
    for update;

    if not found or selected_gig.poster_id <> current_user_id then
        raise exception 'Gig not found or you are not its poster.'
            using errcode = '42501';
    end if;

    if selected_gig.status <> 'open'
       or exists (
            select 1 from public.applications a
            where a.gig_id = selected_gig.id
              and a.status = 'accepted'
       ) then
        raise exception 'Only open gigs without accepted workers can be edited.'
            using errcode = '23514';
    end if;

    p_title := btrim(coalesce(p_title, ''));
    p_description := btrim(coalesce(p_description, ''));
    p_category := nullif(btrim(coalesce(p_category, '')), '');
    p_location := nullif(btrim(coalesce(p_location, '')), '');

    if p_title = '' or length(p_title) > 120 then
        raise exception 'Gig title is required and must be 120 characters or fewer.'
            using errcode = '23514';
    end if;

    if p_description = '' or length(p_description) > 5000 then
        raise exception 'Gig description is required and must be 5000 characters or fewer.'
            using errcode = '23514';
    end if;

    if p_budget is not null and (p_budget < 0 or p_budget > 1000000) then
        raise exception 'Gig budget must be between KES 0 and KES 1,000,000.'
            using errcode = '23514';
    end if;

    update public.gigs
    set title = p_title,
        description = p_description,
        category = p_category,
        location = p_location,
        budget = p_budget
    where id = selected_gig.id;

    return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Function permissions.
-- ---------------------------------------------------------------------------
revoke all on function public.accept_application(bigint, numeric) from public, anon;
revoke all on function public.reject_application(bigint) from public, anon;
revoke all on function public.set_gig_status(bigint, text) from public, anon;
revoke all on function public.complete_gig(bigint) from public, anon;
revoke all on function public.cancel_gig(bigint) from public, anon;
revoke all on function public.update_gig(bigint, text, text, text, text, numeric) from public, anon;

grant execute on function public.accept_application(bigint, numeric) to authenticated;
grant execute on function public.reject_application(bigint) to authenticated;
grant execute on function public.set_gig_status(bigint, text) to authenticated;
grant execute on function public.complete_gig(bigint) to authenticated;
grant execute on function public.cancel_gig(bigint) to authenticated;
grant execute on function public.update_gig(bigint, text, text, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS policies and direct table privileges.
-- ---------------------------------------------------------------------------
alter table public.gigs enable row level security;
alter table public.applications enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.profiles enable row level security;

create policy gigs_select_visible
on public.gigs
for select
to authenticated
using (
    status = 'open'
    or poster_id = (select auth.uid())
    or public.worker_has_accepted_application(id)
);

create policy gigs_insert_own_open
on public.gigs
for insert
to authenticated
with check (
    poster_id = (select auth.uid())
    and status = 'open'
);

create policy applications_select_worker_or_poster
on public.applications
for select
to authenticated
using (
    worker_id = (select auth.uid())
    or exists (
        select 1
        from public.gigs g
        where g.id = applications.gig_id
          and g.poster_id = (select auth.uid())
    )
);

create policy applications_insert_own_pending
on public.applications
for insert
to authenticated
with check (
    worker_id = (select auth.uid())
    and status = 'pending'
);

create policy payment_transactions_select_participant
on public.payment_transactions
for select
to authenticated
using (
    payer_id = (select auth.uid())
    or worker_id = (select auth.uid())
);

-- No direct profile policies: profile data is available through the two RPCs.
-- No direct UPDATE/DELETE policies for gigs or applications.
-- No direct INSERT/UPDATE/DELETE policies for payment_transactions.

revoke all on public.gigs from anon, authenticated;
revoke all on public.applications from anon, authenticated;
revoke all on public.payment_transactions from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select on public.gigs to authenticated;
grant insert (poster_id, title, description, location, budget, category, status, agreed_price, payment_status)
    on public.gigs to authenticated;

grant select on public.applications to authenticated;
grant insert (gig_id, message) on public.applications to authenticated;

grant select on public.payment_transactions to authenticated;

grant all on public.gigs to service_role;
grant all on public.applications to service_role;
grant all on public.payment_transactions to service_role;
grant all on public.profiles to service_role;

revoke all on sequence public.gigs_id_seq from anon, authenticated;
revoke all on sequence public.applications_id_seq from anon, authenticated;
revoke all on sequence public.payment_transactions_id_seq from anon, authenticated;
revoke all on sequence public.profiles_id_seq from anon, authenticated;

grant all on sequence public.gigs_id_seq to service_role;
grant all on sequence public.applications_id_seq to service_role;
grant all on sequence public.payment_transactions_id_seq to service_role;
grant all on sequence public.profiles_id_seq to service_role;

-- Stop future objects created by the postgres migration role from inheriting
-- the old blanket anon grants.
alter default privileges for role postgres in schema public
    revoke all on tables from anon;
alter default privileges for role postgres in schema public
    revoke all on sequences from anon;
alter default privileges for role postgres in schema public
    revoke all on functions from anon;

commit;
