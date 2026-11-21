
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { test } from "node:test";
import request from "supertest";
import { app } from "../app.js";
import { requireRole } from "../middlewares/auth.middleware.js";

function createAuthenticatedRequest(
  role: "customer" | "admin",
): Request {
  return {
    authenticatedUser: {
      id: "507f1f77bcf86cd799439011",
      name: "Test User",
      email: "test@example.com",
      image: "",
      role,
    },
  } as unknown as Request;
}

test("GET /api/auth/me should reject requests without a token", async () => {
  const response = await request(app).get("/api/auth/me");

  assert.equal(response.status, 401);
});

test("GET /api/auth/me should reject malformed JWT tokens", async () => {
  const response = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
});

test("GET /api/services/admin should reject requests without a token", async () => {
  const response = await request(app).get("/api/services/admin");

  assert.equal(response.status, 401);
});

test("POST /api/services should reject requests without a token", async () => {
  const response = await request(app)
    .post("/api/services")
    .send({});

  assert.equal(response.status, 401);
});

test("GET /api/users/:id should reject requests without a token", async () => {
  const response = await request(app).get(
    "/api/users/507f1f77bcf86cd799439011",
  );

  assert.equal(response.status, 401);
});

test("Unknown API routes should return 404", async () => {
  const response = await request(app).get("/api/this-route-does-not-exist");

  assert.equal(response.status, 404);
});

test("Customer should be rejected from admin-only middleware", () => {
  const middleware = requireRole("admin");
  const req = createAuthenticatedRequest("customer");
  let nextCalls = 0;
  let nextError: unknown;

  const next: NextFunction = (error?: unknown) => {
    nextCalls += 1;
    nextError = error;
  };

  middleware(req, {} as Response, next);

  assert.equal(nextCalls, 1);
  assert.notEqual(nextError, undefined);
});

test("Admin should pass admin-only middleware", () => {
  const middleware = requireRole("admin");
  const req = createAuthenticatedRequest("admin");
  let nextCalls = 0;
  let nextError: unknown;

  const next: NextFunction = (error?: unknown) => {
    nextCalls += 1;
    nextError = error;
  };

  middleware(req, {} as Response, next);

  assert.equal(nextCalls, 1);
  assert.equal(nextError, undefined);
});
