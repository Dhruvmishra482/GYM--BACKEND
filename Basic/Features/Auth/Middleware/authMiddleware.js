
const jwt = require("jsonwebtoken");
const Owner = require("../../MemberCrud/Models/Owner"); // Adjust path as needed
require("dotenv").config();

exports.auth = async (req, res, next) => {
  try {
    // Extract token from multiple sources (prioritize cookies for web app)
    const token =
      req.cookies?.token ||
      req.body?.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log("Token from cookie:", req.cookies?.token);
    console.log("Token from body:", req.body?.token);
    console.log("Token from header:", req.header("Authorization"));
    console.log("Extracted token:", token);

    if (!token) {
      return res.status(401).json({
         success: false,
         message: "Access denied. No token provided."
       });
    }

    console.log("JWT_SECRET:", process.env.JWT_SECRET);
    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not defined in .env");
        return res.status(500).json({
            success: false,
            message: "Server configuration error: JWT_SECRET missing."
        });
    }

    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);
             
      // Optional: Fetch fresh user data from database to ensure user still exists
      // and hasn't been deactivated (recommended for better security)
      const user = await Owner.findById(decoded.id).select('-password');
      console.log("User found:", user ? user.email : "none");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found. Please login again."
        });
      }

      // NEW: Check and auto-downgrade expired subscriptions (non-breaking addition)
      if (user.subscriptionPlan !== "NONE" && user.subscriptionExpiry) {
        if (new Date() > user.subscriptionExpiry) {
          // Auto-downgrade to NONE if subscription expired
          user.subscriptionPlan = "NONE";
          user.subscriptionExpiry = null;
          await user.save();
          
          console.log(`Auto-downgraded user ${user.email} to NONE (no subscription) due to expiry`);
        }
      }

       // Attach both decoded token data and fresh user data to request
       req.user = {
         id: decoded.id,
         email: decoded.email,
         role: decoded.role,
         accountType: user.accountType,
         // NEW: Add subscription data to req.user (non-breaking addition)
         subscriptionPlan: user.subscriptionPlan,
         subscriptionExpiry: user.subscriptionExpiry,
         hasActiveSubscription: user.hasActiveSubscription(),
         ...user.toObject() // Include fresh user data from database
       };
             
      next();
    } catch (err) {
      console.error("Token verification error:", err);
             
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
           success: false,
           message: "Invalid token. Please login again."
         });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
           success: false,
           message: "Token expired. Please login again."
         });
      }
             
      return res.status(401).json({
         success: false,
         message: "Token verification failed"
       });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
       success: false,
       message: "Authentication service error"
     });
  }
};

// EXISTING: Keep the original isOwner middleware unchanged
exports.isOwner = (req, res, next) => {
  try {
    // Check if user exists and has the correct role
    if (!req.user) {
      return res.status(401).json({
         success: false,
         message: "Authentication required"
       });
    }

    // Check both role and accountType for owner
    if (req.user.role !== "owner" && req.user.accountType !== "owner") {
      return res.status(403).json({
         success: false,
         message: "Access denied. Owner privileges required."
       });
    }
         
    next();
  } catch (error) {
    console.error("Owner role check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authorization service error"
    });
  }
};