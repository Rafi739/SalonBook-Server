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

## Development

```sh
npm run dev
```

The server listens on `PORT` (default `3000`). It attempts the MongoDB connection after startup; a connection failure is logged and does not prevent the HTTP server from starting.

## API

- `GET /api/health` reports API uptime and MongoDB connection state. It returns `200` when the database is connected and `503` otherwise.

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
