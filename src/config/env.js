const dotenv = require("dotenv");

dotenv.config();

const clientUrls = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "change-me-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientUrls,
};

module.exports = env;
