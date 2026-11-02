# Kichele Link — migrations

One canonical model is shared by the database, the Edge Functions and the frontend:

- Gig, application and profile IDs are **bigint** identities.
- Each accepted application stores its own **agreed_price** (per-application pricing).
- Every payment transaction references one **application_id**.
- Posters pay per accepted application through the `mpesa-stk-push` Edge Function;
  `mpesa-callback` confirms and reconciles payment by `application_id`.

## Files, in order

| File                                            | Purpose                                                                                                                                                                                                                                                                            | Notes                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `000_baseline_live_schema.sql`                  | Fresh-environment baseline: recreates the audited live tables (`gigs`, `applications`, `payment_transactions`, `profiles`) with bigint identities, keys and the checkout partial-unique index. Structure only; RLS on with deny-by-default.                                        | Run first in a fresh environment.                                                                                           |
| `001_create_gigs.sql`                           | **Historical.** Early `gigs` design (UUID primary key, few columns, single table). Superseded by the audited live schema and never by later files.                                                                                                                                 | Do not run in a fresh environment.                                                                                          |
| `002_lock_down_rls.sql`                         | First hardening pass: client write limits on `applications`/`payment_transactions`, `public_profile` view, profile RPCs, grant hygiene.                                                                                                                                            | Requires the audited live structure (all four tables).                                                                      |
| `003_restore_application_trigger.sql`           | Reinstates the hardened application insert/update trigger.                                                                                                                                                                                                                         | Requires the audited live structure.                                                                                        |
| `004_per_application_pricing_and_workflows.sql` | **Canonical.** Per-application `agreed_price`, `payment_transactions.application_id`, `public_profile` view, profile and workflow RPCs (`accept_application`, `reject_application`, `set_gig_status`, `complete_gig`, `cancel_gig`, `update_gig`), least-privilege RLS and grants. | Targets the audited live schema (see `supabase/audit/live_schema_20261030.sql`). Applied to the live project on 2026-11-02. |

## Applying

1. **Fresh environment** (local `supabase start` or a new project): run
   `000`, `002`, `003`, `004` in that order. Skip `001`.
2. **Linked live project**: migrations 002, 003 and 004 were applied to
   `kichele-connect` (qqvdsevkewjvohbctoop) via `supabase db push` on
   2026-11-02. Run `supabase migration list --remote` before further
   changes so local and remote histories stay in step.
3. A stale audit snapshot is kept in `supabase/audit/live_schema_20261030.sql`;
   refresh it after applying `004` so the audited baseline stays truthful.
