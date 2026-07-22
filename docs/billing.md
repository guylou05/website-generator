# Organization billing

Laravel is the billing authority. Stripe Checkout and the customer portal host all payment UI; a success redirect never grants access. Subscription webhooks select an internal `free`, `starter`, `pro`, or `agency` plan through server-owned price mappings.

## Stripe setup

1. In Stripe test mode create Starter, Pro, and Agency products with recurring monthly and yearly prices. Copy the six `price_…` identifiers to the corresponding `STRIPE_PRICE_*` variables. Never put the secret or webhook secret in a `NEXT_PUBLIC_*` variable.
2. Create a Billing Portal configuration for payment methods, invoices, billing/tax details, cancellation, and permitted plan changes; set `STRIPE_PORTAL_CONFIGURATION_ID` if a non-default configuration is required.
3. Start the stack (`docker compose up --build`) and authenticate the Stripe CLI.
4. Forward signed events: `stripe listen --forward-to localhost:8080/api/webhooks/stripe`, then copy its `whsec_…` value to `STRIPE_WEBHOOK_SECRET` and restart the API.
5. Open **Dashboard → Settings → Billing**. Checkout and portal redirects are restricted to exact origins from `DASHBOARD_URL`.

Use Stripe test cards and test clocks to exercise renewals, trials, and cancellation. Simulate a failed invoice with Stripe's documented failure test payment method, and confirm the dashboard shows `past_due` and the configured grace deadline.

## Usage policy

A generation unit is reserved when a new `GenerationRun` is accepted; internal OpenAI stage retries reuse that ledger idempotency key. A user-created retry is a new run and unit. A live deployment is reserved when accepted; previews do not consume live allowance. The ledger is append-only: refunds are separate negative entries. Free organizations use calendar months in `BILLING_USAGE_TIMEZONE`; paid organizations use Stripe subscription periods. Pending invitations do not reserve seats, but creating an invitation is blocked when all active seats are occupied. Archived projects and deleted connections do not count.

Support can inspect records with `php artisan tinker` and the `Subscription`, `OrganizationBillingProfile`, and `UsageLedger` models. Apply an idempotent credit with `UsageService::record($organization, 'generations', -1, 'support_credit', null, 'ticket-UNIQUE')`. Subscription resynchronization should retrieve Stripe's latest subscription and feed it through the same subscription mapping used by webhooks.

## Operations and security

Monitor `stripe_webhook_events` for `failed` rows. Events are persisted by ID and payload hash before processing; duplicates return success. Stored errors are bounded and full payloads are never logged. Rotate compromised keys in Stripe and the API environment. Automated tests must mock Stripe and must not use real payment or email services.
