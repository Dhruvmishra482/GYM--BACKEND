const express = require("express");
const router = express.Router();

const {
  sendAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  getAnnouncementStats,
  deleteAnnouncement,
  previewAnnouncementMessage,
} = require("../controllers/announcementController");

const {
  auth,
  isOwner,
} = require("../../../../Basic/Features/Auth/Middleware/authMiddleware");
const {
  isSubscribed,
  checkSubscriptionExpiry,
} = require("../../../../Basic/Features/Subscription/Middleware/subscriptionMiddleware");

router.post(
  "/send",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  sendAnnouncement
);

router.get(
  "/all",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  getAllAnnouncements
);

router.get(
  "/:announcementId",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  getAnnouncementById
);

router.get(
  "/:announcementId/stats",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
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
