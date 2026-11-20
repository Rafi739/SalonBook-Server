
import { getDatabaseCollections } from "../config/collections.js";
import type { AdminDashboardOverview } from "../types/dashboard.js";

export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const {
    users,
    services,
    appointments,
    transactions,
  } = await getDatabaseCollections();

  const [
    totalCustomers,
    totalServices,
    activeServices,
    inactiveServices,
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
    rejectedAppointments,
    revenueByCurrency,
  ] = await Promise.all([
    users.countDocuments({ role: "customer" }),

    services.countDocuments(),
    services.countDocuments({ status: "active" }),
    services.countDocuments({ status: "inactive" }),

    appointments.countDocuments(),
    appointments.countDocuments({ status: "pending" }),
    appointments.countDocuments({ status: "confirmed" }),
    appointments.countDocuments({ status: "completed" }),
    appointments.countDocuments({ status: "cancelled" }),
    appointments.countDocuments({ status: "rejected" }),

    transactions.aggregate<{
      _id: string;
      amount: number;
      transactions: number;
    }>([
      {
        $match: {
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$currency",
          amount: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).toArray(),
  ]);

  return {
    totalCustomers,
    totalServices,
    activeServices,
    inactiveServices,
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
    rejectedAppointments,
    revenueByCurrency: revenueByCurrency.map((item) => ({
      currency: item._id,
      amount: item.amount,
      transactions: item.transactions,
    })),
  };
}
