const express = require("express");
const router = express.Router();
<<<<<<< HEAD

=======
const { body, validationResult } = require("express-validator");

// Import controllers
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
const {
  sendAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  getAnnouncementStats,
  deleteAnnouncement,
  previewAnnouncementMessage,
<<<<<<< HEAD
} = require("../controllers/announcementController");

const {
  auth,
  isOwner,
} = require("../../../../Basic/Features/Auth/Middleware/authMiddleware");
const {
  isSubscribed,
  checkSubscriptionExpiry,
} = require("../../../../Basic/Features/Subscription/Middleware/subscriptionMiddleware");

=======
  updateAnnouncement,
} = require("../controllers/announcementController");

// Import middleware
const { auth, isOwner } = require("../../../../Basic/Features/Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../../../Basic/Features/Subscription/Middleware/subscriptionMiddleware");

// Validation middleware for creating announcement
const announcementValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3-200 characters"),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 5, max: 1000 })
    .withMessage("Message must be between 5-1000 characters"),

  body("announcementType")
    .optional()
    .isIn(["General", "Promotion", "Maintenance", "Event", "Urgent"])
    .withMessage("Invalid announcement type"),

  body("priority")
    .optional()
    .isIn(["Low", "Medium", "High", "Urgent"])
    .withMessage("Invalid priority level"),

  body("filterGender")
    .optional()
    .isIn(["All", "Male", "Female"])
    .withMessage("Invalid gender filter"),

  body("filterPaymentStatus")
    .optional()
    .isIn(["All", "Paid", "Pending"])
    .withMessage("Invalid payment status filter"),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }
  next();
};

// ===== PUBLIC ROUTES =====

// Health check (optional)
router.get("/health", (req, res) => {
  res.json({ status: "Announcement API is running" });
});

// ===== PROTECTED ROUTES - BASIC & ADVANCED PLAN =====

// Send announcement immediately
// POST /api/v1/announcement/send
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
router.post(
  "/send",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
<<<<<<< HEAD
  sendAnnouncement
);

=======
  announcementValidation,
  handleValidationErrors,
  sendAnnouncement
);

// Preview announcement message before sending
// POST /api/v1/announcement/preview
router.post(
  "/preview",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  previewAnnouncementMessage
);

// Get all announcements for owner
// GET /api/v1/announcement/all?page=1&limit=10
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
router.get(
  "/all",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  getAllAnnouncements
);

<<<<<<< HEAD
=======
// Get announcement statistics
// GET /api/v1/announcement/:announcementId/stats
router.get(
  "/:announcementId/stats",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  getAnnouncementStats
);

// Get single announcement by ID
// GET /api/v1/announcement/:announcementId
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
router.get(
  "/:announcementId",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  getAnnouncementById
);
<<<<<<< HEAD

router.get(
  "/:announcementId/stats",
=======

// Update announcement
// PUT /api/v1/announcement/:announcementId
router.put(
  "/:announcementId",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  updateAnnouncement
);

// Delete announcement
// DELETE /api/v1/announcement/:announcementId
router.delete(
  "/:announcementId",
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
<<<<<<< HEAD
  getAnnouncementStats
);

router.delete(
  "/:announcementId",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  deleteAnnouncement
);

router.post(
  "/preview",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  previewAnnouncementMessage
);

module.exports = router;
=======
  deleteAnnouncement
);

module.exports = router;
>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8
