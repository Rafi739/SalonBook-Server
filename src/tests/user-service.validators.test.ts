
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseUserListQuery,
  validateProfileUpdate,
} from "../validators/user.validators.js";

import {
  parseAdminServiceListQuery,
  parsePublicServiceListQuery,
  validateCreateService,
  validateServiceStatus,
  validateServiceUpdate,
} from "../validators/service.validators.js";

// User profile validation

test("Should trim and validate a customer profile name", () => {
  assert.deepEqual(validateProfileUpdate({ name: "  Rafi  " }), {
    name: "Rafi",
  });
});

test("Should accept a valid profile image URL", () => {
  assert.deepEqual(
    validateProfileUpdate({ image: "https://example.com/avatar.png" }),
    { image: "https://example.com/avatar.png" },
  );
});

test("Should reject an empty profile name", () => {
  assert.throws(() => validateProfileUpdate({ name: "   " }));
});

test("Should reject an invalid profile image protocol", () => {
  assert.throws(() =>
    validateProfileUpdate({ image: "javascript:alert(1)" }),
  );
});

test("Should reject profile updates containing unknown fields", () => {
  assert.throws(() =>
    validateProfileUpdate({ name: "Rafi", role: "admin" }),
  );
});

test("Should reject an empty profile update", () => {
  assert.throws(() => validateProfileUpdate({}));
});

// User list query validation

test("Should parse valid user list filters and sorting", () => {
  assert.deepEqual(
    parseUserListQuery({
      page: "2",
      limit: "10",
      search: " Rafi ",
      role: "customer",
      blocked: "false",
      sortBy: "name",
      sortOrder: "asc",
    }),
    {
      page: 2,
      limit: 10,
      search: "Rafi",
      role: "customer",
      blocked: false,
      sortBy: "name",
      sortOrder: "asc",
    },
  );
});

test("Should apply default user list pagination and sorting", () => {
  assert.deepEqual(parseUserListQuery({}), {
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
});

test("Should reject an invalid user role filter", () => {
  assert.throws(() => parseUserListQuery({ role: "superadmin" }));
});

test("Should reject an invalid blocked filter", () => {
  assert.throws(() => parseUserListQuery({ blocked: "yes" }));
});

test("Should reject unsupported user sorting fields", () => {
  assert.throws(() => parseUserListQuery({ sortBy: "password" }));
});

test("Should reject a user list limit above the maximum", () => {
  assert.throws(() => parseUserListQuery({ limit: "101" }));
});

test("Should reject unsupported user list query parameters", () => {
  assert.throws(() => parseUserListQuery({ password: "secret" }));
});

// Service validation

const validService = {
  serviceName: "  Hair Styling  ",
  category: "Men's",
  description: "  Professional hair styling service  ",
  price: 50,
  duration: 45,
  image: "https://example.com/service.jpg",
};

test("Should validate and normalize a new service", () => {
  assert.deepEqual(validateCreateService(validService), {
    ...validService,
    serviceName: "Hair Styling",
    description: "Professional hair styling service",
  });
});

test("Should reject a service with an invalid category", () => {
  assert.throws(() =>
    validateCreateService({
      ...validService,
      category: "Children",
    }),
  );
});

test("Should reject a service with an invalid price", () => {
  assert.throws(() =>
    validateCreateService({
      ...validService,
      price: -10,
    }),
  );
});

test("Should reject a service with a non-integer duration", () => {
  assert.throws(() =>
    validateCreateService({
      ...validService,
      duration: 30.5,
    }),
  );
});

test("Should reject a service image using HTTP", () => {
  assert.throws(() =>
    validateCreateService({
      ...validService,
      image: "http://example.com/service.jpg",
    }),
  );
});

test("Should reject unknown service fields", () => {
  assert.throws(() =>
    validateCreateService({
      ...validService,
      createdBy: "someone",
    }),
  );
});

test("Should validate a partial service update", () => {
  assert.deepEqual(
    validateServiceUpdate({ price: 75, status: "inactive" }),
    { price: 75, status: "inactive" },
  );
});

test("Should reject an empty service update", () => {
  assert.throws(() => validateServiceUpdate({}));
});

test("Should validate an active service status", () => {
  assert.deepEqual(validateServiceStatus({ status: "active" }), {
    status: "active",
  });
});

test("Should reject an invalid service status", () => {
  assert.throws(() => validateServiceStatus({ status: "deleted" }));
});



test("Should parse public service search, category and price sorting", () => {
  assert.deepEqual(
    parsePublicServiceListQuery({
      page: "2",
      limit: "12",
      search: "Hair",
      category: "Men's",
      sort: "price_asc",
    }),
    {
      page: 2,
      limit: 12,
      search: "Hair",
      category: "Men's",
      sort: "price_asc",
    },
  );
});

test("Should apply default public service list filters", () => {
  assert.deepEqual(parsePublicServiceListQuery({}), {
    page: 1,
    limit: 20,
    sort: "price_asc",
  });
});

test("Should reject an unsupported service price sort", () => {
  assert.throws(() =>
    parsePublicServiceListQuery({ sort: "name_asc" }),
  );
});

test("Should parse admin service status filters", () => {
  assert.deepEqual(
    parseAdminServiceListQuery({
      page: "1",
      limit: "20",
      sort: "price_desc",
      status: "inactive",
    }),
    {
      page: 1,
      limit: 20,
      sort: "price_desc",
      status: "inactive",
    },
  );
});

test("Should reject an invalid admin service status filter", () => {
  assert.throws(() =>
    parseAdminServiceListQuery({ status: "deleted" }),
  );
});
