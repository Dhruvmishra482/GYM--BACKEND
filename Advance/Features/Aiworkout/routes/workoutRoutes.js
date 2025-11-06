const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");

// Import controllers
const {
    createWorkoutPlan,
    getAllWorkoutPlans,
    getWorkoutPlanById,
    updateWorkoutPlan,
    deleteWorkoutPlan,
    broadcastWorkoutPlan,
    getWorkoutPlanStats,
    previewWorkoutPlanMessage
} = require("../controllers/createWorkoutPlan");

// Import middleware
const { auth, isOwner } = require("../../../../Basic/Features/Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../../../Basic/Features/Subscription/Middleware/subscriptionMiddleware");

// Validation middleware for creating/updating workout plan
const workoutPlanValidation = [
    body("planTitle")
        .trim()
        .notEmpty()
        .withMessage("Plan title is required")
        .isLength({ min: 3, max: 200 })
        .withMessage("Plan title must be between 3-200 characters"),
    
    body("planType")
        .optional()
        .isIn(['Strength Training', 'Cardio Focus', 'Weight Loss', 'Muscle Building', 'Endurance', 'General Fitness', 'Custom'])
        .withMessage("Invalid plan type"),
    
    body("targetAudience")
        .optional()
        .isIn(['All Members', 'Male Only', 'Female Only', 'Beginners', 'Intermediate', 'Advanced', 'Custom Selection'])
        .withMessage("Invalid target audience"),
    
    body("difficultyLevel")
        .optional()
        .isIn(['Beginner', 'Intermediate', 'Advanced'])
        .withMessage("Invalid difficulty level"),
    
    body("planDuration")
        .optional()
        .isIn(['1 week', '2 weeks', '4 weeks', '8 weeks', '12 weeks', 'Ongoing'])
        .withMessage("Invalid plan duration"),
    
    body("workoutsPerWeek")
        .optional()
        .isInt({ min: 1, max: 7 })
        .withMessage("Workouts per week must be between 1 and 7"),
    
    body("weeklySchedule")
        .notEmpty()
        .withMessage("Weekly schedule is required")
        .isObject()
        .withMessage("Weekly schedule must be an object"),
    
    body("generalInstructions")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("General instructions must be less than 2000 characters"),
    
    body("progressionNotes")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Progression notes must be less than 1000 characters")
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

// Create new workout plan
// POST /api/v1/workout-plan/create
router.post(
    "/create",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    workoutPlanValidation,
    handleValidationErrors,
    createWorkoutPlan
);

// Get all workout plans for owner
// GET /api/v1/workout-plan/all?status=Active&page=1&limit=10
router.get(
    "/all",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getAllWorkoutPlans
);

// Get single workout plan by ID
// GET /api/v1/workout-plan/:planId
router.get(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getWorkoutPlanById
);

// Update workout plan
// PUT /api/v1/workout-plan/:planId
router.put(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    workoutPlanValidation,
    handleValidationErrors,
    updateWorkoutPlan
);

// Delete workout plan
// DELETE /api/v1/workout-plan/:planId
router.delete(
    "/:planId",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    deleteWorkoutPlan
);

// ===== BROADCAST FEATURE - MAIN FEATURE =====

// Broadcast workout plan to all members
// POST /api/v1/workout-plan/:planId/broadcast
// Body: { filterGender: "Male" | "Female" | "All", filterStatus: "Paid" | "Pending" | "All" }
router.post(
    "/:planId/broadcast",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    broadcastWorkoutPlan
);

// ===== ANALYTICS & PREVIEW ROUTES =====

// Get delivery statistics for a workout plan
// GET /api/v1/workout-plan/:planId/stats
router.get(
    "/:planId/stats",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    getWorkoutPlanStats
);

// Preview workout plan message before sending
// GET /api/v1/workout-plan/:planId/preview
router.get(
    "/:planId/preview",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    previewWorkoutPlanMessage
);

module.exports = router;