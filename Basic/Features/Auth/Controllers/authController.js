const Owner = require("../../MemberCrud/Models/Owner");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const OTP = require("../Models/Otp");
const { mailSender } = require("../../../../Utils/mailSender");
const { otpEmailTemplate } = require("../../../../Templates/otpEmailTemplate");
const resetPasswordTemplate = require("../../../../Templates/resetPasswordTemplate");
const passwordResetSuccessTemplate = require("../../../../Templates/passwordResetSuccessTemplate");
// const rateLimit = require('express-rate-limit');
// exports.signUp = async (req, res) => {
//   try {
//     const { firstName, lastName, mobileNumber, email, password } = req.body;

//        console.log("Signup Request Body:", req.body);

//     const existingUser = await Owner.findOne({ email });
//     if (existingUser) {
//       return res.status(409).json({ success: false, message: "User already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 12);

//     const user = await Owner.create({
//       firstName,
//       lastName,
//       mobileNumber,
//       email,
//       password: hashedPassword,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "User registered successfully",
//       user: {
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         mobileNumber: user.mobileNumber,
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: "Something went wrong, please try again" });
//   }
// };
const generateNumericOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.signUp = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      mobileNumber,
      email,
      password,
      confirmPassword,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !mobileNumber ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existingUser = await Owner.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const otp = generateNumericOTP();

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });
    await OTP.create({ email, otp });

    await mailSender(
      email,
      "Your OTP for Signup - Gym Management",
      otpEmailTemplate(otp, firstName)
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      userData: {
        firstName,
        lastName,
        mobileNumber,
        email,
        password,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { otp, firstName, lastName, mobileNumber, email, password } =
      req.body;

    if (!otp || !email) {
      return res
        .status(400)
        .json({ success: false, message: "OTP and Email are required" });
    }

    const response = await OTP.findOne({ email, otp });

    if (!response) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await Owner.create({
      firstName,
      lastName,
      password: hashedPassword,
      mobileNumber,
      email,
    });

    await OTP.deleteMany({ email });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.accountType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ FIX: Use same cookie settings as login
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: isProduction, // ✅ Changed
      sameSite: isProduction ? "none" : "lax", // ✅ Changed from "strict"
      path: "/",
    });

    user.password = undefined; // Remove password from response

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        accountType: user.accountType,
        gymDetails: user.gymDetails,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP and register",
    });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email, firstName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user already exists
    const existingUser = await Owner.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const otp = generateNumericOTP();

    // Delete existing OTPs and create new one
    await OTP.deleteMany({ email });
    await OTP.create({ email, otp });

    await mailSender(
      email,
      "Your OTP for Signup - Gym Management",
      otpEmailTemplate(otp, firstName || "User")
    );

    return res.status(200).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("REQ BODY: ", req.body);

    const user = await Owner.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not registered",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.accountType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } // Changed to 7 days to match frontend
    );

    // Remove password from user object
    user.password = undefined;

    // Cookie settings - adjust based on environment
    const isProduction = process.env.NODE_ENV === "production";

    res
      .cookie("token", token, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to match frontend
        httpOnly: true,
        secure: isProduction, // true in production, false in development
        sameSite: isProduction ? "none" : "lax", // "none" for production with HTTPS, "lax" for development
        path: "/", // Ensure cookie is available for all routes
      })
      .status(200)
      .json({
        success: true,
        message: "Login successful",
        user, // Only send user data, not the token (since it's in httpOnly cookie)
      });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to login, please try again",
    });
  }
};

exports.logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res
    .clearCookie("token", { 
      httpOnly: true, 
      sameSite: isProduction ? "none" : "lax", // ✅ Changed
      secure: isProduction, // ✅ Changed
      path: '/'
    })
    .status(200)
    .json({
      success: true,
      message: "Logged out successfully",
    });
};

exports.forgotPassword = async (req, res) => {
  try {
    console.log("Forgot Password request received"); // ✅ request reach ho rahi hai ya nahi

    const { email } = req.body;
    console.log("Email received:", email); // ✅ email correctly aa rahi hai ya nahi

    if (!email) {
      console.log("Email missing");
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const owner = await Owner.findOne({ email });
    console.log("Owner found:", owner); // ✅ DB me owner exist karta hai ya nahi

    if (!owner) {
      console.log("Owner not found");
      return res
        .status(404)
        .json({ success: false, message: "Owner does not exist" });
    }

    const token = jwt.sign({ email: owner.email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    console.log("Token generated:", token); // ✅ JWT generate ho raha hai ya nahi

    const resetLink = `${process.env.FRONT_END_URL}/reset-password/${token}`;
    console.log("Reset link:", resetLink);

    await mailSender(
      owner.email,
      "Reset Your Password - Gym Management",
      resetPasswordTemplate(resetLink, owner.firstName || "Owner")
    );
    console.log("Mail sent successfully");

    return res
      .status(200)
      .json({ success: true, message: "Reset link sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error); // ✅ exact error kya aa raha hai
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const owner = await Owner.findOne({ email: decoded.email });

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    owner.password = hashedPassword;
    await owner.save();

    await mailSender(
      owner.email,
      "Password Reset Successful - Gym Management",
      passwordResetSuccessTemplate(owner.firstName || "Owner")
    );

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};
