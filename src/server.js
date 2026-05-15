const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
const setupSwagger = require("./config/swagger");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientUrls.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

setupSwagger(app);
app.use("/api", routes);

app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  // eslint-disable-next-line no-console
  console.log("SIGTERM received — closing server.");
  await disconnectDB();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

start();
