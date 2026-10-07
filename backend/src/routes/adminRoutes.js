import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roles.js";
import { upload } from "../utils/upload.js";
import {
  approveEvent,
  createAdminMovieShow,
  updateAdminMovieShow,
  rejectEvent,
  listPendingEvents,
  listAdminUsers,
  blockUser,
  unblockUser,
  getAdminDashboard,
  getAdminAnalytics,
} from "../controllers/adminController.js";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));
router.get("/dashboard", getAdminDashboard);
router.get("/analytics", getAdminAnalytics);
router.get("/users", listAdminUsers);
router.post("/movies", upload.single("poster"), createAdminMovieShow);
router.put("/movies/:id", upload.single("poster"), updateAdminMovieShow);
router.get("/events/pending", listPendingEvents);
router.post("/events/:id/approve", approveEvent);
router.post("/events/:id/reject", rejectEvent);
router.post("/users/:id/block", blockUser);
router.post("/users/:id/unblock", unblockUser);

export default router;
