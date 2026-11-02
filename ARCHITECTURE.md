# Kichele Link – System Architecture

**Tagline:** Pata Kazi, Pata Kichele.

Kichele Link is a gig marketplace that connects people who need tasks
completed with people who are available to perform those tasks.

The system is organised conceptually into three main layers:

1. FRONTEND – the user interface and user interactions.
2. BACKEND – application workflows and server-side processing.
3. DATABASE – persistent data storage and data protection.

These are conceptual layers. The existing SvelteKit and Supabase
directory structure must remain unchanged.

---

# 1. FRONTEND

## 1.1 Technology

- SvelteKit
- TypeScript
- Svelte components
- Supabase browser client
- Tailwind CSS

## 1.2 Location

`src/`

The frontend contains the pages and shared code used by people
interacting with Kichele Link.

## 1.3 Main routes

| Location                          | Responsibility                               |
| --------------------------------- | -------------------------------------------- |
| `src/routes/+page.svelte`         | Public landing page                          |
| `src/routes/login/`               | User login                                   |
| `src/routes/signup/`              | User registration                            |
| `src/routes/dashboard/`           | Gig poster dashboard and workflow management |
| `src/routes/gigs/`                | Gig listing and gig details                  |
| `src/routes/marketplace/`         | Gig marketplace                              |
| `src/routes/post-gig/`            | Creating a gig                               |
| `src/routes/profile/`             | Viewing and updating profile information     |
| `src/routes/worker/`              | Worker area                                  |
| `src/routes/worker/applications/` | Worker's applications                        |
| `src/routes/worker/jobs/`         | Worker's accepted jobs                       |

## 1.4 Supabase integration

Location:

`src/lib/supabase/client.ts`

This file creates the browser Supabase client using the public
Supabase URL and anonymous key.

The browser client is used for authentication, database queries
and database function calls.

The public anonymous key is not a replacement for database security.
Access must be restricted through authentication, permissions and RLS.

## 1.5 Payment-related shared code

Location:

`src/lib/payment-security/`

This directory contains payment-related validation and reconciliation
logic, including associated tests.

It is separate from the server-side payment provider integration.

---

# 2. BACKEND

## 2.1 Technology

- Supabase Edge Functions
- Deno
- TypeScript
- Supabase server-side client
- Database RPC functions

## 2.2 Edge Functions

Location:

`supabase/functions/`

These functions provide server-side processing.

### M-Pesa STK Push

Location:

`supabase/functions/mpesa-stk-push/`

Contract (aligned with migration `004` and the frontend):

- Request: `POST` with the caller's bearer token and a JSON body of
  `{ application_id, phone_number }`.
- `application_id` must be an accepted application that stores its own
  `agreed_price`.
- The calling user must be the poster of the application's gig, the gig
  must be closed or completed, unpaid, and the matching payment
  transaction must exist, be pending and match the agreed price.
- Uses server-side credentials for database operations.
- Communicates with the PayHero payment provider.
- Uses the payment transaction ID as the PayHero external reference and
  records PayHero's identifiers on the transaction.

### M-Pesa callback

Location:

`supabase/functions/mpesa-callback/`

Contract:

- Receives payment provider callback information (no JWT required; PayHero
  cannot authenticate).
- Looks up the transaction by the transaction ID that was registered as the
  PayHero external reference.
- Verifies that the transaction is linked to an accepted application whose
  gig, worker and agreed price all match the transaction.
- Verifies transaction amount, phone, result code and receipt, and
  independently re-checks the payment status with PayHero before recording.
- Marks a gig paid only when every accepted application on the gig has
  exactly one paid transaction (mirrors the shared
  `areAllAcceptedApplicationsPaid` helper).

IMPORTANT: The payment functions are documented here as existing
source code. Their presence does not establish that live payment
processing is enabled, tested or operational. Payment initiation happens
from the poster dashboard through `supabase.functions.invoke`.

## 2.3 Database RPC functions

Migration `supabase/migrations/004_per_application_pricing_and_workflows.sql`
defines the following database workflows:

| Function             | Responsibility                                                                   |
| -------------------- | -------------------------------------------------------------------------------- |
| `get_my_profile`     | Retrieve the signed-in user's private profile                                    |
| `upsert_my_profile`  | Create or update the signed-in user's profile                                    |
| `accept_application` | Accept an application, store its agreed price and create its payment transaction |
| `reject_application` | Reject a pending application                                                     |
| `set_gig_status`     | Open or close a gig                                                              |
| `complete_gig`       | Mark an eligible gig as completed                                                |
| `cancel_gig`         | Cancel an eligible gig                                                           |
| `update_gig`         | Update an eligible gig                                                           |

These functions execute inside PostgreSQL. They are backend
workflow operations even though the frontend calls them through
the Supabase browser client.

See `supabase/migrations/README.md` for the migration order and the
application procedure for fresh and linked environments.

---

# 3. DATABASE

## 3.1 Technology

- Supabase PostgreSQL
- SQL migrations
- Row Level Security (RLS)
- Database triggers
- Database functions
- Database constraints and indexes

## 3.2 Location

`supabase/migrations/`

This directory contains SQL files defining database structure,
security policies and workflow rules (see its `README.md` for the
order and application procedure):

- `000_baseline_live_schema.sql` – audited live structure baseline
- `001_create_gigs.sql` – historical, superseded by the audited live schema
- `002_lock_down_rls.sql`
- `003_restore_application_trigger.sql`
- `004_per_application_pricing_and_workflows.sql` – canonical model

An audited snapshot of the deployed schema is kept at
`supabase/audit/live_schema_20261030.sql`.

## 3.3 Main data entities

| Table                  | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `gigs`                 | Stores gig information and ownership                                         |
| `applications`         | Stores workers' applications, each with its own `agreed_price` when accepted |
| `profiles`             | Stores user profile information                                              |
| `payment_transactions` | Stores one payment record per accepted application (`application_id`)        |

## 3.4 Database security

The inspected SQL uses:

- Row Level Security to control data access.
- Policies to restrict access by authenticated user.
- Triggers to validate selected inserts and updates.
- Database functions to perform controlled workflow operations.
- Function permissions to restrict who can execute sensitive functions.
- A public profile view intended to expose limited profile data.

The service-role key must remain server-side and must never be
exposed in browser code.

---

# 4. HOW THE THREE LAYERS COMMUNICATE

A typical Kichele Link request follows this path:

1. A user interacts with a SvelteKit frontend page.
2. The frontend uses the Supabase browser client.
3. Supabase authenticates the request.
4. The request reaches a database table, RPC function or Edge Function.
5. Database permissions, RLS and applicable triggers enforce rules.
6. The result is returned to the frontend.
7. The frontend displays a success message or error.

## Examples

### Posting a gig

Frontend:
`src/routes/post-gig/+page.svelte`

Database operation:
Insert into `gigs`.

Database controls:
Triggers from the hardening migrations assign ownership and enforce
initial gig values.

### Applying for a gig

Frontend:
`src/routes/gigs/[id]/+page.svelte`

Database operation:
Insert into `applications`.

Database controls:
Triggers assign the worker ID and pending status and validate the gig.

### Accepting an application

Frontend:
`src/routes/dashboard/+page.svelte`

Backend workflow:
`accept_application`

Database operations:
Update the application (including its agreed price), create a payment
transaction for it and close the gig as one database operation.

### Paying an accepted application (M-Pesa STK Push)

Frontend:
`src/routes/dashboard/+page.svelte` ("Pay Worker" flow)

Backend workflow:
Edge Function `mpesa-stk-push` with `{ application_id, phone_number }`.

Database operations:
Verify the accepted application, its gig ownership, eligibility and the
payment transaction created by `accept_application`; then request the
PayHero STK push and record the provider identifiers.

### Confirming payment (M-Pesa callback)

Backend workflow:
Edge Function `mpesa-callback` (PayHero only; no user session).

Database operations:
Verify the transaction against its accepted application and re-check the
payment with PayHero, mark the transaction paid and reconcile the gig's
`payment_status` across all accepted applications.

---

# 5. TESTING

The repository includes tests for selected application and
payment-security behaviour.

Tests help verify expected behaviour but do not, by themselves,
prove that the deployed database, provider configuration or live
environment is correct.

Relevant source locations include:

- `src/lib/payment-security/`
- Test files within the source tree
- Supabase function test files, where present

---

# 6. ARCHITECTURE REVIEW NOTES

The earlier inspection findings have been resolved and deployed:

1. Migration 001's UUID gig design is superseded by the audited bigint
   live schema, preserved as `000_baseline_live_schema.sql` and
   documented in `supabase/migrations/README.md`.
2. The per-application pricing design is a tracked migration:
   `supabase/migrations/004_per_application_pricing_and_workflows.sql`.
3. The STK Push and callback Edge Functions use per-application
   pricing and the `application_id` payment linkage, matching migration
   `004` and the frontend.
4. The frontend-to-Edge-Function integration is established: the poster
   dashboard invokes `mpesa-stk-push` through
   `supabase.functions.invoke`.
5. Migrations 002–004 were applied to the live project
   (`kichele-connect`, qqvdsevkewjvohbctoop) with `supabase db push`
   on 2026-11-02, and both Edge Functions were deployed the same day
   (STK Push verifies JWT at the gateway; the callback does not, per
   PayHero's requirements).

Live payment processing is now enabled end to end in code and
configuration. The final operational step is a small real-amount test
transaction to confirm PayHero's prompt, callback and reconciliation
behave in production.

Historical review documents are kept in `docs/reviews/`. These are
review findings, not confirmed production failures. Do not apply
further migrations or change live payment configuration without a
separate review and authorisation.

---

# 7. ARCHITECTURE SUMMARY

| Layer    | Main location                                  | Main responsibility                            |
| -------- | ---------------------------------------------- | ---------------------------------------------- |
| FRONTEND | `src/`                                         | User interface and interactions                |
| BACKEND  | `supabase/functions/` and database RPCs        | Server-side processing and business workflows  |
| DATABASE | `supabase/migrations/` and Supabase PostgreSQL | Data storage, relationships and access control |

Kichele Link uses SvelteKit for its frontend and Supabase for
authentication, backend services and PostgreSQL data storage.

The three layers work together to provide the gig marketplace.
