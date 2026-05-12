const { loginSchema } = require("../validators/authValidator");
const authService = require("../services/authService");
const ApiError = require("../utils/apiError");

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ApiError(400, "Validation failed.", parsed.error.flatten()));
    }

    const result = await authService.login(parsed.data);
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
}

module.exports = { login, me };
