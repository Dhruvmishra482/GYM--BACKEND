
const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  getAllMembers,
  addMember,
  editMember,
  getMemberByPhone,
  searchMember,
  getAllMemberNames,
  getAllDueMembers,
  sendMemberReminder,
  markMemberFeePaid,
  getMemberDetails,
  sendAllMemberReminders,
} = require("../Controllers/memberController");

// Import existing auth middleware
const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");
// Import subscription middleware
const { isSubscribed, checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");
// Import limit enforcement middleware
const { 
  checkMemberLimit,
  trackMemberAddition, 
  trackMemberDeletion,
  checkFeatureLimit,
  trackFeatureUsage 
} = require("../../Subscription/Middleware/limitEnforcementMiddleware");

const router = express.Router();

// Validation middleware (unchanged)
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ success: false, errors: errors.array() });
};

// ===== SUBSCRIPTION-PROTECTED ROUTES =====

// Get All Members - Requires active subscription
router.get("/allmembers", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  getAllMembers
);

// Add Member - UPDATED WITH LIMIT ENFORCEMENT
router.post(
  "/addmember",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  checkMemberLimit,        // CHECK MEMBER LIMIT BEFORE ADDING
  validate([
    body("name").notEmpty(),
    body("phoneNo").notEmpty(),
    body("feesAmount").notEmpty(),
    body("nextDueDate").notEmpty(),
    body("address").notEmpty(),
  ]),
  addMember,
  trackMemberAddition      // TRACK MEMBER ADDITION AFTER SUCCESS
);

// Edit Member - Requires subscription
router.get("/getmember/:phoneNo", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  getMemberByPhone
);

router.patch("/editmember/:phoneNo", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  editMember
);

// Search Member - WITH FEATURE LIMIT ENFORCEMENT
router.get("/search/:query", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  checkFeatureLimit('searchQueries'),  // CHECK SEARCH LIMIT
  searchMember,
  trackFeatureUsage('searchQueries')   // TRACK SEARCH USAGE
);

// Get All Member Names - Debug route
router.get("/debug/names", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  getAllMemberNames
);

// ===== DUE MEMBERS ROUTES - SUBSCRIPTION PROTECTED =====

router.use("/duemembers", (req, res, next) => {
  console.log("🌐 Due members route middleware HIT (/duemembers)");
  next();
});

router.use("/due-members", (req, res, next) => {
  console.log("🌐 Due members route middleware HIT (/due-members)");
  next();
});

// Get All Due Members - WITH ANALYTICS TRACKING
router.get(
  "/duemembers",
  auth,
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  checkFeatureLimit('analyticsViews'),  // CHECK ANALYTICS LIMIT
  (req, res, next) => {
    console.log("🎯 Due members route handler reached (duemembers)");
    console.log("✅ All middleware passed");
    next();
  },
  getAllDueMembers,
  trackFeatureUsage('analyticsViews')   // TRACK ANALYTICS USAGE
);

// Alternative endpoint for due members
router.get("/due-members", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  checkFeatureLimit('analyticsViews'),
  getAllDueMembers,
  trackFeatureUsage('analyticsViews')
);

// Send reminders to all due members - WITH WHATSAPP LIMIT
router.post("/send-all-reminders", 
  auth, isOwner, checkSubscriptionExpiry, isSubscribed,
  checkFeatureLimit('whatsappReminders'),
  sendAllMemberReminders
  // Remove: trackFeatureUsage('whatsappReminders')
);

// ===== DYNAMIC PARAMETER ROUTES - WITH LIMITS =====

// Send reminder to specific member - WITH WHATSAPP LIMIT
router.post("/:memberId/send-reminder", 
  auth, isOwner, checkSubscriptionExpiry, isSubscribed,
  checkFeatureLimit('whatsappReminders'),
  sendMemberReminder
  // Remove: trackFeatureUsage('whatsappReminders')
);


// Mark member as paid - Core feature
router.patch("/:memberId/mark-paid", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  markMemberFeePaid
);

// Get member details - WITH ANALYTICS TRACKING
router.get("/:memberId/details", 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  isSubscribed,
  checkFeatureLimit('analyticsViews'),  // CHECK ANALYTICS LIMIT
  getMemberDetails,
  trackFeatureUsage('analyticsViews')   // TRACK ANALYTICS USAGE
);

// DELETE MEMBER ROUTE - WITH TRACKING
// router.delete("/:memberId", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   async (req, res, next) => {
//     // Delete member logic here
//     // ... your delete member code ...
//     next();
//   },
//   trackMemberDeletion  // TRACK MEMBER DELETION
// );

// ===== FREE PREVIEW ROUTES =====

router.get("/preview/features", 
  auth, 
  isOwner,
  (req, res) => {
    const { subscriptionPlan } = req.user;
    
    if (subscriptionPlan === "NONE") {
      return res.json({
        success: true,
        message: "Subscription required to access member management features",
        needsSubscription: true,
        availableFeatures: [
          "Manage up to 150 members",
          "AI-powered member insights", 
          "Smart payment reminders (WhatsApp)",
          "Member dashboard with profiles",
          "Basic analytics reports",
          "Due notifications to owner",
          "24/7 chat & email support"
        ],
        currentPlan: "NONE",
        upgradeUrl: "/pricing"
      });
    } else {
      return res.json({
        success: true,
        message: `Welcome to ${subscriptionPlan} plan!`,
        currentPlan: subscriptionPlan,
        hasAccess: true
      });
    }
  }
);

module.exports = router;

// const express = require("express");
// const { body, validationResult } = require("express-validator");
// const {
//   getAllMembers,
//   addMember,
//   editMember,
//   getMemberByPhone,
//   searchMember,
//   getAllMemberNames,
//   getAllDueMembers,
//   sendMemberReminder,
//   markMemberFeePaid,
//   getMemberDetails,
//   sendAllMemberReminders,
// } = require("../controllers/memberController");

// // Import existing auth middleware
// const { auth, isOwner } = require("../middleware/authMiddleware");
// // Import subscription middleware
// const { isSubscribed, checkSubscriptionExpiry } = require("../middleware/subscriptionMiddleware");
// // Import limit enforcement middleware
// const { 
//   checkMemberLimit,
//   trackMemberAddition, 
//   trackMemberDeletion,
//   checkFeatureLimit,
//   trackFeatureUsage 
// } = require("../middleware/limitEnforcementMiddleware");

// const router = express.Router();

// // Validation middleware
// const validate = (validations) => async (req, res, next) => {
//   await Promise.all(validations.map((v) => v.run(req)));
//   const errors = validationResult(req);
//   if (errors.isEmpty()) return next();
//   return res.status(400).json({ success: false, errors: errors.array() });
// };

// // ===== BASIC ROUTES (NO PARAMETERS) =====

// // Get All Members - Requires active subscription
// router.get("/allmembers", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   getAllMembers
// );

// // Add Member - UPDATED WITH LIMIT ENFORCEMENT
// router.post(
//   "/addmember",
//   auth,
//   isOwner,
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkMemberLimit,
//   validate([
//     body("name").notEmpty(),
//     body("phoneNo").notEmpty(),
//     body("feesAmount").notEmpty(),
//     body("nextDueDate").notEmpty(),
//     body("address").notEmpty(),
//   ]),
//   addMember,
//   trackMemberAddition
// );

// // Get All Member Names - Debug route
// router.get("/debug/names", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   getAllMemberNames
// );

// // Get All Due Members
// router.get("/duemembers",
//   auth,
//   isOwner,
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('analyticsViews'),
//   getAllDueMembers,
//   trackFeatureUsage('analyticsViews')
// );

// // Alternative endpoint for due members
// router.get("/due-members", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('analyticsViews'),
//   getAllDueMembers,
//   trackFeatureUsage('analyticsViews')
// );

// // Send reminders to all due members
// router.post("/send-all-reminders", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('whatsappReminders'),
//   sendAllMemberReminders,
//   trackFeatureUsage('whatsappReminders')
// );

// // Free preview route
// router.get("/preview/features", 
//   auth, 
//   isOwner,
//   (req, res) => {
//     const { subscriptionPlan } = req.user;
    
//     if (subscriptionPlan === "NONE") {
//       return res.json({
//         success: true,
//         message: "Subscription required to access member management features",
//         needsSubscription: true,
//         availableFeatures: [
//           "Manage up to 150 members",
//           "AI-powered member insights", 
//           "Smart payment reminders (WhatsApp)",
//           "Member dashboard with profiles",
//           "Basic analytics reports",
//           "Due notifications to owner",
//           "24/7 chat & email support"
//         ],
//         currentPlan: "NONE",
//         upgradeUrl: "/pricing"
//       });
//     } else {
//       return res.json({
//         success: true,
//         message: `Welcome to ${subscriptionPlan} plan!`,
//         currentPlan: subscriptionPlan,
//         hasAccess: true
//       });
//     }
//   }
// );

// // ===== COMMENTED OUT DYNAMIC ROUTES =====
// // Uncomment these one by one to find the problematic route

// /*
// // Edit Member - Requires subscription
// router.get("/getmember/:phoneNo", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   getMemberByPhone
// );

// router.patch("/editmember/:phoneNo", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   editMember
// );

// // Search Member
// router.get("/search/:query", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('searchQueries'),
//   searchMember,
//   trackFeatureUsage('searchQueries')
// );

// // Send reminder to specific member
// router.post("/:memberId/send-reminder", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('whatsappReminders'),
//   sendMemberReminder,
//   trackFeatureUsage('whatsappReminders')
// );

// // Mark member as paid
// router.patch("/:memberId/mark-paid", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   markMemberFeePaid
// );

// // Get member details
// router.get("/:memberId/details", 
//   auth, 
//   isOwner, 
//   checkSubscriptionExpiry,
//   isSubscribed,
//   checkFeatureLimit('analyticsViews'),
//   getMemberDetails,
//   trackFeatureUsage('analyticsViews')
// );
// */

// module.exports = router;