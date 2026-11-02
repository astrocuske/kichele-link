-- 002_lock_down_rls.sql
-- Hardens applications, payment_transactions, and profiles for client access:
--   applications:
--     - clients can only INSERT their own application, always status 'pending',
--       only on open gigs, with a bounded message
--     - posters can only UPDATE pending -> accepted/rejected; contact columns
--       are immutable for clients
--   payment_transactions:
--     - client INSERTs must satisfy: payer owns the gig, amount equals the
--       gig's agreed price (whole KES, 1..1_000_000), the payee has an
--       accepted application, and status is forced to 'pending'
--   profiles:
--     - phone/location are no longer readable by other users; names are
--       served through the public_profile view, own row through RPCs
--   grants:
--     - anon loses all direct table access

begin;

-- ============================================================
-- Helper: role of the current PostgREST/Supabase request
-- ============================================================
create or replace function public.request_role()
returns text
language sql
stable
set search_path = ''
as $$
    select coalesce(current_setting('request.jwt.claim.role', true), 'anon');
$$;

-- ============================================================
-- applications integrity
-- ============================================================
create or replace function public.enforce_application_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    caller_role text := public.request_role();
begin
    if caller_role = 'service_role' then
        return new;
    end if;

    if tg_op = 'INSERT' then
        -- Workers never choose their own status: applications start pending.
        new.worker_id := auth.uid();
        new.status := 'pending';

        if not exists (
            select 1 from public.gigs g
            where g.id = new.gig_id
              and g.status = 'open'
        ) then
            raise exception 'Applications can only be submitted to open gigs.'
            using errcode = '23514';
        end if;

        if new.message is not null and length(new.message) > 2000 then
            raise exception 'Application message must be 2000 characters or fewer.'
            using errcode = '22001';
        end if;
    end if;

    if tg_op = 'UPDATE' then
        -- Only a status transition is allowed, and only from pending.
        if old.gig_id is distinct from new.gig_id
            or old.worker_id is distinct from new.worker_id
            or old.message is distinct from new.message
            or old.created_at is distinct from new.created_at
        then
            raise exception 'Only the application status can be updated.'
            using errcode = '23514';
        end if;

        if old.status is distinct from 'pending' then
            raise exception 'Only pending applications can be updated.'
            using errcode = '23514';
        end if;

        if new.status not in ('accepted', 'rejected') then
            raise exception 'Applications can only be set to accepted or rejected.'
            using errcode = '23514';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists applications_enforce_rules on public.applications;

create trigger applications_enforce_rules
before insert or update on public.applications
for each row
execute function public.enforce_application_rules();

-- ============================================================
-- payment_transactions integrity
-- ============================================================
create or replace function public.enforce_payment_transaction_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    caller_role text := public.request_role();
    gig public.gigs;
begin
    if caller_role = 'service_role' then
        return new;
    end if;

    if tg_op = 'INSERT' or tg_op = 'UPDATE' then
        new.status := 'pending';
    end if;

    if tg_op = 'INSERT' then
        select * into gig
        from public.gigs g
        where g.id = new.gig_id;

        if gig.id is null then
            raise exception 'Payment does not reference an existing gig.'
            using errcode = '23514';
        end if;

        if gig.poster_id is distinct from new.payer_id then
            raise exception 'Payment records can only be created by the gig poster.'
            using errcode = '23514';
        end if;

        if gig.agreed_price is null or gig.agreed_price is distinct from new.amount then
            raise exception 'Payment amount must equal the agreed price on the gig.'
            using errcode = '23514';
        end if;

        if new.amount is null
            or new.amount <> floor(new.amount)
            or new.amount < 1
            or new.amount > 1000000
        then
            raise exception 'Payment amount must be a whole number between KES 1 and KES 1,000,000.'
            using errcode = '23514';
        end if;

        if not exists (
            select 1 from public.applications a
            where a.gig_id = new.gig_id
              and a.worker_id = new.worker_id
              and a.status = 'accepted'
        ) then
            raise exception 'The selected worker does not have an accepted application for this gig.'
            using errcode = '23514';
        end if;

        new.payer_id := gig.poster_id;
    end if;

    return new;
end;
$$;

drop trigger if exists payment_transactions_enforce_rules on public.payment_transactions;

create trigger payment_transactions_enforce_rules
before insert or update on public.payment_transactions
for each row
execute function public.enforce_payment_transaction_rules();

-- ============================================================
-- profiles: hide phone/location from other users
-- ============================================================
create or replace view public.public_profile
with (security_barrier = true)
as
    select p.user_id, p.full_name
    from public.profiles p;

revoke all on public.public_profile from anon;
grant select on public.public_profile to authenticated;

create or replace function public.get_my_profile()
returns table (
    full_name text,
    phone text,
    location text
)
language sql
security definer
set search_path = public
as $$
    select p.full_name, p.phone, p.location
    from public.profiles p
    where p.user_id = auth.uid();
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
set search_path = public
as $$
begin
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

    insert into public.profiles (user_id, full_name, phone, location)
    values (
        auth.uid(),
        nullif(p_full_name, ''),
        nullif(p_phone, ''),
        nullif(p_location, '')
    )
    on conflict (user_id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        location = excluded.location
    where profiles.user_id = auth.uid();

    return query
    select p.full_name, p.phone, p.location
    from public.profiles p
    where p.user_id = auth.uid();
end;
$$;

-- Clients no longer read/write the base table directly.
drop policy if exists "Authenticated users can view profile names" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Enable insert for users based on user_id" on public.profiles;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

-- ============================================================
-- Grant hygiene: every direct-table write is grant-scoped
-- ============================================================
revoke all on public.gigs from anon;
revoke all on public.applications from anon;
revoke all on public.payment_transactions from anon;
revoke all on sequence public.gigs_id_seq
    , public.applications_id_seq
    , public.payment_transactions_id_seq
    , public.profiles_id_seq
from anon;

grant select, insert, update on public.applications to authenticated;
grant select, insert on public.payment_transactions to authenticated;

commit;
