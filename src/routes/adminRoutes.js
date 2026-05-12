const express = require("express");
const { authenticate, authorizeRoles } = require("../middlewares/auth");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/dashboard", (req, res) => res.status(200).json({ success: true, message: "Admin module online." }));

router.get("/stations", adminController.listStations);
router.post("/stations", adminController.createStation);
router.put("/stations/:id", adminController.updateStation);
router.delete("/stations/:id", adminController.deleteStation);

router.get("/users", adminController.listUsers);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

router.get("/shifts", adminController.listShifts);
router.post("/shifts", adminController.createShift);
router.put("/shifts/:id", adminController.updateShift);
router.delete("/shifts/:id", adminController.deleteShift);

router.get("/templates", adminController.listTemplates);
router.post("/templates", adminController.createTemplate);
router.put("/templates/:id", adminController.updateTemplate);
router.delete("/templates/:id", adminController.deleteTemplate);
router.get("/reports/checklists", adminController.checklistReport);

module.exports = router;
