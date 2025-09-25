

const express = require("express");
const { body, validationResult } = require("express-validator");
const { 
  signUp, 
  verifyOTP, 
  resendOTP, 
  login, 
  logout, 
  forgotPassword, 
  resetPassword 
} = require("../Controllers/authController");
const router = express.Router();

const { auth } = require("../Middleware/authMiddleware");

// Step 1: Initial signup (sends OTP)
router.post(
  "/signup",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("mobileNumber").notEmpty().withMessage("Mobile number is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("confirmPassword")
      .notEmpty().withMessage("Confirm Password is required")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      })
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  signUp
);

// Step 2: Verify OTP and complete registration
router.post(
  "/verify-otp",
  [
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be exactly 6 digits")
      .isNumeric()
      .withMessage("OTP must contain only numbers"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("mobileNumber").notEmpty().withMessage("Mobile number is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  verifyOTP
);

// Resend OTP
router.post(
  "/resend-otp",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("firstName").optional().isString().withMessage("First name should be a string")
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  resendOTP
);

// Login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  (req, res, next) => {
    console.log("Login payload:", req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  login
);

// Forgot password
router.post(
  "/forgot-password",
  [
    body("email").isEmail().withMessage("Please provide a valid email address")
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  forgotPassword
);

// Reset password
router.post(
  "/reset-password/:token",
  [
    body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("confirmPassword")
      .notEmpty().withMessage("Confirm Password is required")
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Passwords do not match");
        }
        return true;
      })
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  resetPassword
);

// Logout
router.get("/logout", logout);

// Get current user profile (protected route)
router.get("/me", auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;