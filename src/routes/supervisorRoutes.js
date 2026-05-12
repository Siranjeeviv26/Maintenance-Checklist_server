const express = require("express");
const { authenticate, authorizeRoles } = require("../middlewares/auth");
const supervisorController = require("../controllers/supervisorController");

const router = express.Router();

router.use(authenticate, authorizeRoles("supervisor"));

router.get("/submissions", supervisorController.listSubmitted);
router.post("/submissions/:id/approve", supervisorController.approveSubmission);
router.post("/submissions/:id/reject", supervisorController.rejectSubmission);
router.get("/history", supervisorController.shiftHistory);

module.exports = router;
