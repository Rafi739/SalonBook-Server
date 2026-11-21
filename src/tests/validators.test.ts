
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseAdminAppointmentQuery,
  parseAppointmentHistoryQuery,
  validateAppointmentStatus,
  validateCreateAppointment,
} from "../validators/appointment.validators.js";

import {
  parseAdminTransactionQuery,
  parseCustomerTransactionQuery,
  validateCreateCheckout,
} from "../validators/payment.validators.js";

// Appointment validation tests

test("Should validate a correct appointment status", () => {
  const result = validateAppointmentStatus({
    status: "confirmed",
  });

  assert.equal(result, "confirmed");
});

test("Should reject an invalid appointment status", () => {
  assert.throws(() => {
    validateAppointmentStatus({
      status: "invalid",
    });
  });
});

test("Should reject an appointment request with an invalid service ID", () => {
  assert.throws(() => {
    validateCreateAppointment({
      serviceId: "invalid-id",
      appointmentDate: "2099-12-31",
      timeSlot: "10:00",
    });
  });
});

test("Should reject an invalid appointment date", () => {
  assert.throws(() => {
    validateCreateAppointment({
      serviceId: "507f1f77bcf86cd799439011",
      appointmentDate: "2026-02-30",
      timeSlot: "10:00",
    });
  });
});

test("Should reject an invalid appointment time slot", () => {
  assert.throws(() => {
    validateCreateAppointment({
      serviceId: "507f1f77bcf86cd799439011",
      appointmentDate: "2099-12-31",
      timeSlot: "25:90",
    });
  });
});

test("Should parse valid customer appointment history pagination", () => {
  const result = parseAppointmentHistoryQuery({
    page: "2",
    limit: "10",
    status: "pending",
  });

  assert.equal(result.page, 2);
  assert.equal(result.limit, 10);
  assert.equal(result.status, "pending");
});

test("Should reject an invalid appointment history status", () => {
  assert.throws(() => {
    parseAppointmentHistoryQuery({
      status: "unknown",
    });
  });
});

test("Should parse valid admin appointment filters", () => {
  const result = parseAdminAppointmentQuery({
    page: "1",
    limit: "20",
    status: "confirmed",
    paymentStatus: "unpaid",
    sortBy: "appointmentDate",
    sortOrder: "asc",
  });

  assert.equal(result.status, "confirmed");
  assert.equal(result.paymentStatus, "unpaid");
  assert.equal(result.sortBy, "appointmentDate");
  assert.equal(result.sortOrder, "asc");
});

// Payment validation tests

test("Should validate a correct checkout appointment ID", () => {
  const result = validateCreateCheckout({
    appointmentId: "507f1f77bcf86cd799439011",
  });

  assert.equal(
    result.appointmentId.toHexString(),
    "507f1f77bcf86cd799439011",
  );
});

test("Should reject an invalid checkout appointment ID", () => {
  assert.throws(() => {
    validateCreateCheckout({
      appointmentId: "invalid-id",
    });
  });
});

test("Should parse valid customer transaction pagination", () => {
  const result = parseCustomerTransactionQuery({
    page: "2",
    limit: "10",
  });

  assert.equal(result.page, 2);
  assert.equal(result.limit, 10);
});

test("Should reject status filters in customer transaction history", () => {
  assert.throws(() => {
    parseCustomerTransactionQuery({
      status: "completed",
    });
  });
});

test("Should parse valid admin transaction filters", () => {
  const result = parseAdminTransactionQuery({
    page: "1",
    limit: "20",
    status: "completed",
    dateFrom: "2026-01-01",
    dateTo: "2026-12-31",
  });

  assert.equal(result.page, 1);
  assert.equal(result.limit, 20);
  assert.equal(result.status, "completed");
  assert.equal(result.dateFrom?.toISOString(), "2026-01-01T00:00:00.000Z");
});
