const { ERROR_CODES, sendSuccess, sendError } = require("../utils/response");
const { ERRORS } = require("../utils/messages");
const { getDashboardStatsData } = require("../services/stats.service");

const getDashboardStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await getDashboardStatsData(days);

    return sendSuccess(res, { data });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.dashboardStats,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.dashboardStats,
      statusCode: 500,
    });
  }
};

module.exports = { getDashboardStats };
