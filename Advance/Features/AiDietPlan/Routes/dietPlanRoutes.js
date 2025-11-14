const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");

// Import controllers
const {
    createDietPlan,
    getAllDietPlans,
    getDietPlanById,
    updateDietPlan,
    deleteDietPlan,
    broadcastDietPlan,
    getDietPlanStats,
    previewDietPlanMessage
} = require("../Controllers/createDietPlan");

// Import middleware
const { auth, isOwner } = require("../../../../Basic/Features/Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../../../Basic/Features/Subscription/Middleware/subscriptionMiddleware");

// Validation middleware for creating/updating diet plan
const dietPlanValidation = [
    body("planTitle")
        .trim()
        .notEmpty()
        .withMessage("Plan title is required")
        .isLength({ min: 3, max: 200 })
        .withMessage("Plan title must be between 3-200 characters"),
    
    body("planType")
        .optional()
        .isIn(['Weight Loss', 'Weight Gain', 'Muscle Building', 'Maintenance', 'General Health', 'Custom'])
        .withMessage("Invalid plan type"),
    
    body("targetAudience")
        .optional()
        .isIn(['All Members', 'Male Only', 'Female Only', 'Beginners', 'Advanced', 'Custom Selection'])
        .withMessage("Invalid target audience"),
    
    body("planDuration")
        .optional()
        .isIn(['1 week', '2 weeks', '1 month', '3 months', 'Ongoing'])
        .withMessage("Invalid plan duration"),
    
    body("mealPlan")
        .notEmpty()
        .withMessage("Meal plan is required")
        .isObject()
        .withMessage("Meal plan must be an object"),
    
    body("waterIntake")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Water intake description too long"),
    
    body("generalInstructions")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("General instructions must be less than 2000 characters")
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array()
        });
    }
    next();
};

// ===== PROTECTED ROUTES - ADVANCED PLAN REQUIRED =====

// Create new diet plan
// POST /api/v1/diet-plan/create
router.post(
    "/create",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    dietPlanValidation,
    handleValidationErrors,
    createDietPlan
);

// Get all diet plans for owner
// GET /api/v1/diet-plan/all?status=Active&page=1&limit=10
router.get(
    "/all",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getAllDietPlans
);

// Get single diet plan by ID
// GET /api/v1/diet-plan/:planId
router.get(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getDietPlanById
);

// Update diet plan
// PUT /api/v1/diet-plan/:planId
router.put(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    dietPlanValidation,
    handleValidationErrors,
    updateDietPlan
);

// Delete diet plan
// DELETE /api/v1/diet-plan/:planId
router.delete(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    deleteDietPlan
);

// ===== BROADCAST FEATURE - MAIN FEATURE =====

// Broadcast diet plan to all members
// POST /api/v1/diet-plan/:planId/broadcast
// Body: { filterGender: "Male" | "Female" | "All", filterStatus: "Paid" | "Pending" | "All" }
router.post(
    "/:planId/broadcast",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    broadcastDietPlan
);

// ===== ANALYTICS & PREVIEW ROUTES =====

// Get delivery statistics for a diet plan
// GET /api/v1/diet-plan/:planId/stats
router.get(
    "/:planId/stats",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getDietPlanStats
);

// Preview diet plan message before sending
// GET /api/v1/diet-plan/:planId/preview
router.get(
    "/:planId/preview",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    previewDietPlanMessage
);

module.exports = router;