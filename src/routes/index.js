const express = require("express");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const staffRoutes = require("./staffRoutes");
const supervisorRoutes = require("./supervisorRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running." });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/staff", staffRoutes);
router.use("/supervisor", supervisorRoutes);

module.exports = router;
