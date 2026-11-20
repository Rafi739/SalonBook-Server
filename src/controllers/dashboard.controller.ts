
import { getAdminDashboardOverview } from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminDashboardOverviewController = asyncHandler(
  async (_request, response) => {
    const overview = await getAdminDashboardOverview();

    response.status(200).json({
      overview,
    });
  },
);
