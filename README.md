# Kichele Link

Pata Kazi, Pata Kichele.

Kichele Link is a gig marketplace that connects people who need tasks
completed with people who are available to perform them.

## Stack

| Layer    | Technology                                     | Location               |
| -------- | ---------------------------------------------- | ---------------------- |
| Frontend | SvelteKit + TypeScript + Tailwind              | `src/`                 |
| Backend  | Supabase Edge Functions (Deno) + database RPCs | `supabase/functions/`  |
| Database | Supabase PostgreSQL + SQL migrations + RLS     | `supabase/migrations/` |

The complete system map — routes, payment flow, contracts between the
layers, and the current state of the M-Pesa STK push integration — is
documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Payment integration

Payments use per-application pricing (`applications.agreed_price`) and
M-Pesa STK push via PayHero:

1. Accept an application → the `accept_application` RPC creates its
   pending `payment_transactions` row.
2. Poster dashboard "Pay Worker" → the `mpesa-stk-push` Edge Function
   starts a PayHero STK push for that application.
3. PayHero → the `mpesa-callback` Edge Function verifies and records the
   payment, then reconciles the gig's payment status.

Required server secrets: `PAYHERO_AUTH_TOKEN` and `PAYHERO_CHANNEL_ID`.
See `ARCHITECTURE.md` and `supabase/migrations/README.md` for details.

## Developing

```sh
npm install
npm run dev
```

## Checks

```sh
npm run check       # svelte typecheck
npm run lint        # prettier + eslint
npm run test        # unit tests (vitest)
```

## Building

Create a production build:

```sh
npm run build
```
