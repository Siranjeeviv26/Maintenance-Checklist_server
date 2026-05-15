const mongoose = require("mongoose");
const env = require("./env");

async function connectDB() {
  mongoose.connection.on("connected", () => {
    // eslint-disable-next-line no-console
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.log("MongoDB disconnected.");
  });

  await mongoose.connect(env.mongoUri);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
