const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const env = require("../config/env");
const ApiError = require("../utils/apiError");

async function login({ email, password }) {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account is inactive. Please contact the administrator.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name, panelName: user.panelName },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      panelName: user.panelName,
    },
  };
}

module.exports = { login };
