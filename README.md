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

## Authentication

Better Auth remains responsible for registration and login in the frontend. Configure its JWT plugin to publish signing keys at `BETTER_AUTH_JWKS_URL` and to issue tokens with a signed `email` claim and a true `email_verified` (or `emailVerified`) claim. Set `BETTER_AUTH_ISSUER` and `BETTER_AUTH_AUDIENCE` to exactly match the claims configured by Better Auth. These three settings are required for protected routes; missing or invalid settings fail closed with `503`.

The frontend should obtain an access JWT from Better Auth and send it to this API as `Authorization: Bearer <token>`. The Express backend verifies the signature against the remote JWKS and validates issuer, audience, and expiration on each protected request. It then finds the application profile by the signed email claim and uses the MongoDB profile's role and blocked state; client-provided IDs and roles are not used for authorization. Production JWKS URLs must use HTTPS. HTTP is allowed for development and tests.

`GET /api/auth/me` returns the authenticated profile's safe fields (`id`, `name`, `email`, `image`, and database-backed `role`). `requireRole("admin")` and `requireRole("customer")` are available for protecting future routes. Better Auth's own auth collections are separate from SalonBook's application `users` collection. `JWT_SECRET` is not used by this backend.

## Development

```sh
npm run dev
```

The server listens on `PORT` (default `3000`). It attempts the MongoDB connection and initializes collection indexes after startup; a connection or initialization failure is logged and does not prevent the HTTP server from starting. Index setup is cached, and failed initialization can be retried by calling the collection access layer.

Application collections are accessed through `getDatabaseCollections()` in `src/config/collections.ts`. The layer provides typed `users`, `services`, `appointments`, and `transactions` collections and creates their indexes once per successful initialization. Better Auth-owned collections are not managed here.

## API

- `GET /api/health` reports API uptime and MongoDB connection state. It pings MongoDB before reporting it connected, returns `200` when the database is reachable, and `503` otherwise.
- `GET /api/auth/me` returns the current application profile and requires a valid Better Auth JWT.

Authentication environment variables:

- `BETTER_AUTH_JWKS_URL`: Better Auth's public JWKS endpoint.
- `BETTER_AUTH_ISSUER`: expected JWT `iss` claim.
- `BETTER_AUTH_AUDIENCE`: expected JWT `aud` claim.

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
