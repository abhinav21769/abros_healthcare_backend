const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { ERROR_CODES, sendError } = require("../utils/response");
const { ERRORS } = require("../utils/messages");

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return sendError(res, {
        message: ERRORS.auth.unauthorized,
        code: ERROR_CODES.UNAUTHORIZED,
        errorMessage: ERRORS.auth.unauthorized,
        statusCode: 401,
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return sendError(res, {
        message: ERRORS.auth.misconfigured,
        code: ERROR_CODES.INTERNAL_ERROR,
        errorMessage: ERRORS.auth.misconfigured,
        statusCode: 500,
      });
    }

    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.userId).select("-password");

    if (!user || !user.isActive) {
      return sendError(res, {
        message: ERRORS.auth.unauthorized,
        code: ERROR_CODES.UNAUTHORIZED,
        errorMessage: ERRORS.auth.unauthorized,
        statusCode: 401,
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return sendError(res, {
      message: ERRORS.auth.unauthorized,
      code: ERROR_CODES.UNAUTHORIZED,
      errorMessage: ERRORS.auth.unauthorized,
      statusCode: 401,
    });
  }
};

const requireAdminSecret = (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers["x-admin-secret"];

  if (!adminSecret || providedSecret !== adminSecret) {
    return sendError(res, {
      message: ERRORS.auth.forbidden,
      code: ERROR_CODES.FORBIDDEN,
      errorMessage: ERRORS.auth.forbidden,
      statusCode: 403,
    });
  }

  return next();
};

module.exports = { authenticate, requireAdminSecret };
