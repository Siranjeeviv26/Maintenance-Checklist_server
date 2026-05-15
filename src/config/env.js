const dotenv = require("dotenv");

dotenv.config();

function expandLoopbackUrls(urls) {
  const expanded = new Set(urls);

  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.hostname === "localhost") {
        url.hostname = "127.0.0.1";
        expanded.add(url.toString().replace(/\/$/, ""));
      } else if (url.hostname === "127.0.0.1") {
        url.hostname = "localhost";
        expanded.add(url.toString().replace(/\/$/, ""));
      }
    } catch {
      // Keep invalid values untouched so CORS can fail closed.
    }
  }

  return [...expanded];
}

const clientUrls = expandLoopbackUrls(
  (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
);

const nodeEnv = process.env.NODE_ENV || "development";

const mongoUri =
  process.env.MONGO_URI || "mongodb://localhost:27017/maintenance_checklist_development";

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || "change-me-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientUrls,
  mongoUri,
};

module.exports = env;
