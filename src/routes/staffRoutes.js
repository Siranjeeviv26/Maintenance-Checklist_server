const express = require("express");
const { authenticate, authorizeRoles } = require("../middlewares/auth");
const staffController = require("../controllers/staffController");

const router = express.Router();

router.use(authenticate, authorizeRoles("staff"));

router.get("/my-shifts/today", staffController.getMyShiftsToday);
router.get("/checklists/:shiftId", staffController.getShiftChecklist);
router.post("/checklists/:shiftId/submit", staffController.submitChecklist);

module.exports = router;
