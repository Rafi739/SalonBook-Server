
# SalonBook Server

Backend REST API for **SalonBook – Salon Appointment Booking Platform**.

Built with Express.js, TypeScript, MongoDB, Better Auth JWT authentication, and Stripe Checkout.

## Technologies

- Node.js
- Express.js
- TypeScript
- MongoDB
- Better Auth
- JWT Authentication
- Stripe Checkout
- REST API
- Supertest and Node.js Test Runner

## Features

- Secure JWT authentication and role-based authorization.
- Customer profile management.
- Admin customer management and account blocking.
- Salon service CRUD operations.
- Service search, category filtering, and price sorting.
- Appointment booking and status management.
- Duplicate active booking prevention.
- Customer appointment history.
- Admin dashboard statistics.
- Transaction history and payment management.
- Stripe Checkout integration.
- Secure Stripe webhook signature verification.
- Input validation and centralized error handling.
- Automated API and authorization tests.

## Installation

Clone the repository and install dependencies:

```powershell
git clone https://github.com/Rafi739/SalonBook-Server.git
cd SalonBook-Server
npm install
Copy-Item .env.example .env
```

Configure your `.env` file with your MongoDB connection string and Better Auth settings.

## Environment Variables

Configure the following variables in your private `.env` file:

```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=salonbook

BETTER_AUTH_JWKS_URL=http://localhost:3000/api/auth/jwks
BETTER_AUTH_ISSUER=http://localhost:3000
BETTER_AUTH_AUDIENCE=salonbook-api

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=usd
```

**Important:**
- Never commit your private `.env` file.
- Keep MongoDB and Stripe credentials secret.
- The Better Auth issuer and audience must match the frontend authentication configuration.
- Stripe credentials are required for payment testing.

## Run Locally

Start the development server:

```powershell
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/api/health
```

## Main API Endpoints

### Health and Authentication

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/auth/me` | Authenticated |

### User Management

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/users/me` | Authenticated |
| PATCH | `/api/users/me` | Authenticated |
| GET | `/api/users` | Admin |
| GET | `/api/users/:id` | Admin |
| PATCH | `/api/users/:id/block` | Admin |
| PATCH | `/api/users/:id/unblock` | Admin |

### Service Management

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/services` | Public |
| GET | `/api/services/:id` | Public |
| GET | `/api/services/admin` | Admin |
| POST | `/api/services` | Admin |
| PATCH | `/api/services/:id` | Admin |
| PATCH | `/api/services/:id/status` | Admin |
| DELETE | `/api/services/:id` | Admin |

### Appointment Management

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/appointments` | Customer |
| GET | `/api/appointments/me` | Authenticated |
| GET | `/api/appointments/:id` | Authenticated |
| PATCH | `/api/appointments/:id/cancel` | Customer / Admin |
| GET | `/api/appointments` | Admin |
| PATCH | `/api/appointments/:id/status` | Admin |

### Payment and Transactions

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/payments/create-checkout-session` | Customer |
| GET | `/api/payments/me` | Customer |
| GET | `/api/payments` | Admin |
| POST | `/api/payments/webhook` | Stripe Signature |

### Admin Dashboard

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/dashboard/overview` | Admin |

All protected endpoints require a valid Better Auth JWT. Admin-only endpoints additionally verify the authenticated user's admin role.

## Database Collections

The application uses MongoDB with the following main collections:

- `users`
- `services`
- `appointments`
- `transactions`

Better Auth manages its own authentication-related collections.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run automated API and authorization tests |
| `npm run build` | Compile the TypeScript application |
| `npm start` | Start the production server |

## Payment Integration

SalonBook uses Stripe Checkout for confirmed appointments.

Payment security includes:

- Only authenticated customers can initiate payment.
- Customers can pay only for their own confirmed appointments.
- Payment amounts are calculated and validated on the server.
- Checkout sessions are protected against duplicate processing.
- Payment status is updated only after a verified Stripe webhook.
- Duplicate webhook events are handled safely.

For local webhook testing, configure your Stripe test credentials and run:

```powershell
stripe listen --forward-to localhost:4000/api/payments/webhook
```

Use the webhook signing secret provided by Stripe CLI as `STRIPE_WEBHOOK_SECRET`.

## Testing

Run the automated test suite:

```powershell
npm test
```

Run the complete validation commands:

```powershell
npm run typecheck
npm run lint
npm run build
```

## Deployment

The backend is prepared for deployment on Render.

Before production deployment:

1. Configure the production MongoDB connection.
2. Set `NODE_ENV=production`.
3. Configure the frontend URL in `CLIENT_URL`.
4. Configure the production Better Auth JWKS URL and issuer.
5. Set the Stripe production credentials and webhook secret.
6. Ensure all required environment variables are configured securely.

## Repositories

- **Frontend:** https://github.com/Rafi739/SalonBook
- **Backend:** https://github.com/Rafi739/SalonBook-Server

## Security

- JWT verification using Better Auth JWKS.
- Role-based authorization.
- Customer ownership validation.
- Blocked-account protection.
- Server-side input validation.
- Secure payment amount verification.
- Stripe webhook signature verification.
- Environment secrets excluded from Git.
