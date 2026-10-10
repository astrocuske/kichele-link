create table public.gigs (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  location text,
  budget numeric,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.gigs enable row level security;

create policy "Anyone can view open gigs"
on public.gigs
for select
to authenticated
using (status = 'open');

create policy "Users can create their own gigs"
on public.gigs
for insert
to authenticated
with check ((select auth.uid()) = poster_id);

create policy "Users can update their own gigs"
on public.gigs
for update
to authenticated
using ((select auth.uid()) = poster_id)
with check ((select auth.uid()) = poster_id);

create policy "Users can delete their own gigs"
on public.gigs
for delete
to authenticated
using ((select auth.uid()) = poster_id);