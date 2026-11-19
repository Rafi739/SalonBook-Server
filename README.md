# SalonBook Server

Express.js and TypeScript REST API for the SalonBook appointment booking platform. MongoDB access uses the official MongoDB Node.js driver.

## Requirements

- Node.js 20 or newer
- npm
- A MongoDB Atlas cluster (or another MongoDB deployment)

## Installation

```sh
npm install
```

Copy `.env.example` to `.env` and set your local values:

```sh
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead. Set `MONGODB_URI` and `MONGODB_DATABASE` to your own database connection details. Keep `.env` private; it is ignored by Git.

`CLIENT_URL` is the allowed frontend origin for CORS. `JWT_SECRET` is included as a placeholder for later authentication work and is not currently used.

## Stripe configuration

Stripe is optional at server startup so health checks and non-payment APIs remain available when it is not configured. For local testing, add your Stripe **test-mode** secret key (`sk_test_...`), webhook signing secret (`whsec_...`), and a supported three-letter currency such as `usd` to your private `.env`. Never use or commit live secrets in development.

```env
STRIPE_SECRET_KEY=sk_test_replace_with_your_test_secret
STRIPE_WEBHOOK_SECRET=whsec_replace_with_your_webhook_secret
STRIPE_CURRENCY=usd
CLIENT_URL=http://localhost:5173
```

Payment endpoints return `503` until both Stripe keys are configured. `CLIENT_URL` supplies the Checkout success/cancel redirect origin.

## Authentication

Better Auth remains responsible for registration and login in the frontend. Configure its JWT plugin to publish signing keys at `BETTER_AUTH_JWKS_URL` and to issue tokens with a signed `email` claim and a true `email_verified` (or `emailVerified`) claim. Set `BETTER_AUTH_ISSUER` and `BETTER_AUTH_AUDIENCE` to exactly match the claims configured by Better Auth. These three settings are required for protected routes; missing or invalid settings fail closed with `503`.

The frontend should obtain an access JWT from Better Auth and send it to this API as `Authorization: Bearer <token>`. The Express backend verifies the signature against the remote JWKS and validates issuer, audience, and expiration on each protected request. It then finds the application profile by the signed email claim and uses the MongoDB profile's role and blocked state; client-provided IDs and roles are not used for authorization. Production JWKS URLs must use HTTPS. HTTP is allowed for development and tests.

`GET /api/auth/me` returns the authenticated profile's safe fields (`id`, `name`, `email`, `image`, and database-backed `role`). `requireRole("admin")` and `requireRole("customer")` are available for protecting future routes. Better Auth's own auth collections are separate from SalonBook's application `users` collection. `JWT_SECRET` is not used by this backend.

## User management API

All user-management endpoints require `Authorization: Bearer <Better Auth JWT>`. Customer profile endpoints resolve the target only from the verified request context. Admin endpoints additionally require the user's `admin` role from the MongoDB application profile; role and blocked state are never accepted from the client.

### Customer profile

- `GET /api/users/me` returns the caller's safe profile.
- `PATCH /api/users/me` updates only `name` and/or `image`. Names must be 1–100 characters after trimming; images must be valid HTTP or HTTPS URLs. Other fields, including email, role, and blocked state, are rejected.

Example response:

```json
{
  "user": {
    "id": "<object-id>",
    "name": "<name>",
    "email": "<email>",
    "image": "https://example.com/profile-image",
    "role": "customer",
    "createdAt": "<ISO-8601 timestamp>"
  }
}
```

### Admin user management

- `GET /api/users` lists users with pagination and optional filters.
- `GET /api/users/:id` returns one user; `:id` must be a MongoDB ObjectId.
- `PATCH /api/users/:id/block` blocks a customer.
- `PATCH /api/users/:id/unblock` unblocks a customer.

List query parameters:

- `page` (default `1`) and `limit` (default `20`, maximum `100`).
- `search` searches name and email (maximum 100 characters).
- `role`: `customer` or `admin`.
- `blocked`: `true` or `false`.
- `sortBy`: `name`, `email`, or `createdAt` (default `createdAt`).
- `sortOrder`: `asc` or `desc` (default `desc`).

Example request: `GET /api/users?page=2&limit=20&search=alex&role=customer&blocked=false&sortBy=createdAt&sortOrder=desc`

The list response contains `users` with safe profile fields plus `isBlocked`, and `pagination` with `page`, `limit`, `total`, `totalPages`, `hasNextPage`, and `hasPreviousPage`. Admins cannot block themselves or another admin; repeated block/unblock operations return `409 Conflict`.

Example admin list response:

```json
{
  "users": [
    {
      "id": "<object-id>",
      "name": "<name>",
      "email": "<email>",
      "image": "https://example.com/profile-image",
      "role": "customer",
      "createdAt": "<ISO-8601 timestamp>",
      "isBlocked": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Invalid IDs, filters, pagination, sorting, or profile updates return `400`; missing/invalid authentication returns `401`; blocked users or insufficient permissions return `403`; missing users return `404`; repeated block-state changes return `409`.

## Service management API

### Public endpoints

- `GET /api/services` lists active services only.
- `GET /api/services/:id` returns an active service; malformed IDs return `400`, while missing or inactive services return `404`.

The list accepts `search` (service name), `category` (`Men's`, `Women's`, or `Unisex`), `sort` (`price_asc` or `price_desc`, default `price_asc`), and `page`/`limit` (defaults `1`/`20`, maximum limit `100`). Search is escaped and filters/sorting/pagination are performed in MongoDB.

Example request: `GET /api/services?search=style&category=Unisex&sort=price_asc&page=1&limit=20`

Example list response:

```json
{
  "services": [
    {
      "id": "<object-id>",
      "serviceName": "<service-name>",
      "category": "Unisex",
      "description": "<description>",
      "price": 45,
      "duration": 60,
      "image": "https://example.com/service-image.jpg",
      "status": "active",
      "createdAt": "<ISO-8601 timestamp>",
      "updatedAt": "<ISO-8601 timestamp>"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Admin endpoints

All service mutations require a Better Auth JWT and the authenticated MongoDB application profile must have role `admin`.

- `POST /api/services` creates a service. `status` defaults to `active`.
- `PATCH /api/services/:id` updates only supplied service fields.
- `PATCH /api/services/:id/status` changes only the status.
- `DELETE /api/services/:id` permanently deletes a service only when no appointment references it.

Example create request:

```json
{
  "serviceName": "<service-name>",
  "category": "Unisex",
  "description": "<service-description>",
  "price": 45,
  "duration": 60,
  "image": "https://example.com/service-image.jpg"
}
```

Example update request: `{"price": 50, "status": "inactive"}`. Status-only request: `{"status": "active"}`. Successful create returns `201` and successful reads/updates return `200`, each with a `service` object containing only the service's public fields and its ID. Delete returns `204`. Invalid service data or list parameters return `400`; unauthorized or non-admin mutations return `401`/`403`; missing or inactive public details return `404`; deletion of a service referenced by appointment history returns `409`. Deletion checks the existing appointment collection inside a MongoDB transaction and never deletes appointments or transactions.

## Appointment booking API

All appointment endpoints require a Better Auth JWT in `Authorization: Bearer <token>`. Customers are identified by their authenticated MongoDB application profile. Admin-only operations use the existing database-backed `admin` role guard.

### Customer operations

- `POST /api/appointments` is customer-only. The request accepts `serviceId`, `appointmentDate` (`YYYY-MM-DD`), `timeSlot` (`HH:mm`, 24-hour), and optional `message` (up to 1000 characters). Dates are normalized to UTC midnight. The API does not impose salon opening hours or invent available slots.
- `GET /api/appointments/me` returns the authenticated account's appointment history, newest appointment dates first. It accepts `page`, `limit`, and an optional valid `status`.
- `GET /api/appointments/:id` lets a customer view only their own appointment; an admin can view any appointment.
- `PATCH /api/appointments/:id/cancel` lets a customer cancel only their own `pending` appointment. Admins can cancel `pending` or `confirmed` appointments.

Example create request:

```json
{
  "serviceId": "<active-service-object-id>",
  "appointmentDate": "<YYYY-MM-DD>",
  "timeSlot": "14:30",
  "message": "<optional note>"
}
```

The customer ID is taken from the verified request, and the service price is read from the active MongoDB service. New appointments always have `status: "pending"` and `paymentStatus: "unpaid"`; clients cannot set either value or `servicePrice`.

### Admin operations

- `GET /api/appointments` lists all appointments. It accepts `page`, `limit`, `status`, `paymentStatus`, `dateFrom`, `dateTo`, `sortBy` (`appointmentDate` or `createdAt`), and `sortOrder` (`asc` or `desc`).
- `PATCH /api/appointments/:id/status` lets admins make only these transitions: `pending` → `confirmed`, `rejected`, or `cancelled`; `confirmed` → `completed` or `cancelled`.

Appointment history responses contain an `appointments` array and `pagination` metadata. Appointment items include the captured `servicePrice`, payment and appointment statuses, and safe service details when available. Admin list/details also include a safe customer summary; authentication fields are never returned.

Example appointment response structure:

```json
{
  "appointment": {
    "id": "<appointment-object-id>",
    "serviceId": "<service-object-id>",
    "customerId": "<customer-object-id>",
    "appointmentDate": "<ISO-8601 UTC date>",
    "timeSlot": "14:30",
    "message": "<note>",
    "servicePrice": 45,
    "paymentStatus": "unpaid",
    "status": "pending",
    "createdAt": "<ISO-8601 timestamp>",
    "updatedAt": "<ISO-8601 timestamp>",
    "service": {
      "id": "<service-object-id>",
      "serviceName": "<service-name>",
      "category": "Unisex",
      "duration": 60,
      "image": "https://example.com/service-image.jpg"
    }
  }
}
```

Duplicate prevention treats only `pending` and `confirmed` appointments as active, keyed by customer, normalized date, and time slot. A unique partial MongoDB index prevents concurrent duplicate bookings for the same customer without reserving the slot globally; cancelled, rejected, and completed appointments do not block another booking. Cancellation and admin status changes use conditional updates. No appointment endpoint changes `paymentStatus`; paid status is reserved for a future verified Stripe webhook.

Invalid inputs return `400`, unauthenticated requests `401`, insufficient permissions `403`, unavailable appointments/services `404`, duplicate bookings, invalid transitions, or referenced-service deletion conflicts `409`.

## Stripe checkout and payment history

### Checkout

- `POST /api/payments/create-checkout-session` requires a customer JWT and accepts only `{"appointmentId":"<appointment-object-id>"}`.
- Only the authenticated customer's confirmed, unpaid appointment can be checked out. The amount comes from its stored `servicePrice`; client amount, currency, customer ID, and payment status fields are rejected.
- A pending database transaction reserves the checkout attempt. The transaction ID is used as Stripe's idempotency key and an existing open Checkout session is returned on repeat requests.
- The response contains only `sessionId` and `url`. Visiting the frontend success URL does not change payment state.

Example request:

```json
{
  "appointmentId": "<confirmed-appointment-object-id>"
}
```

### Transaction history

- `GET /api/payments/me?page=1&limit=20` requires a customer JWT and returns only that customer's transactions, newest first.
- `GET /api/payments?page=1&limit=20&status=completed&dateFrom=2026-01-01&dateTo=2026-12-31` requires an admin JWT and supports status and date filters.

Transaction responses expose only transaction ID, appointment ID, amount, currency, status, and creation time. Admin results may also include safe customer and appointment summaries. Stripe session IDs and secrets are never returned.

### Webhooks and local testing

Configure Stripe to send Checkout events to `https://<api-host>/api/payments/webhook`; the server verifies the `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` using the exact raw request body. For local testing, run the Stripe CLI against the local API:

```sh
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Copy the CLI's printed `whsec_...` value into local `STRIPE_WEBHOOK_SECRET`. Use Stripe test cards from Stripe's documentation to exercise completed, expired, and (where enabled) asynchronous failed payments. The webhook handles `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed`. It checks the stored session/transaction, appointment/customer metadata, currency, amount, and appointment eligibility before marking an appointment paid. Repeated deliveries are processed idempotently; expired and failed sessions do not mark appointments paid. Only a verified successful webhook can update payment status—the browser redirect is not proof of payment.

MongoDB webhook updates use the existing `withDatabaseTransaction` helper and therefore require a transaction-capable MongoDB deployment (for example, Atlas or a replica set).

## Development

```sh
npm run dev
```

The server listens on `PORT` (default `3000`). It attempts the MongoDB connection and initializes collection indexes after startup; a connection or initialization failure is logged and does not prevent the HTTP server from starting. Index setup is cached, and failed initialization can be retried by calling the collection access layer.

Application collections are accessed through `getDatabaseCollections()` in `src/config/collections.ts`. The layer provides typed `users`, `services`, `appointments`, and `transactions` collections and creates their indexes once per successful initialization. Better Auth-owned collections are not managed here.

## API

- `GET /api/health` reports API uptime and MongoDB connection state. It pings MongoDB before reporting it connected, returns `200` when the database is reachable, and `503` otherwise.
- `GET /api/auth/me` returns the current application profile and requires a valid Better Auth JWT.
- `GET` and `PATCH /api/users/me` manage the authenticated customer's profile.
- `GET /api/users` and `GET /api/users/:id` are admin-only user listing and lookup endpoints.
- `PATCH /api/users/:id/block` and `PATCH /api/users/:id/unblock` are admin-only customer account actions.
- `GET /api/services` and `GET /api/services/:id` are public active-service endpoints.
- `POST`, `PATCH`, and `DELETE /api/services...` mutation endpoints require an admin JWT.
- `POST /api/appointments` and customer appointment history/detail/cancellation endpoints require authentication.
- `GET /api/appointments` and `PATCH /api/appointments/:id/status` are admin-only.
- `POST /api/payments/create-checkout-session` and `GET /api/payments/me` are customer-only.
- `GET /api/payments` is admin-only; `POST /api/payments/webhook` is public but requires a valid Stripe signature.

Authentication environment variables:

- `BETTER_AUTH_JWKS_URL`: Better Auth's public JWKS endpoint.
- `BETTER_AUTH_ISSUER`: expected JWT `iss` claim.
- `BETTER_AUTH_AUDIENCE`: expected JWT `aud` claim.
- `STRIPE_SECRET_KEY`: Stripe test/live API secret; use a test key for local integration.
- `STRIPE_WEBHOOK_SECRET`: endpoint or Stripe CLI webhook signing secret.
- `STRIPE_CURRENCY`: three-letter Checkout currency (defaults to `usd`).

## Build and start

```sh
npm run build
npm start
```

## Quality checks

```sh
npm run typecheck
npm run lint
```
