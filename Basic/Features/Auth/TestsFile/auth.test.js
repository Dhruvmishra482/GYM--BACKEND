

require("dotenv").config();
jest.setTimeout(60000);

// Mock the mailSender utility FIRST, before any other imports
jest.mock("../../../../Utils/mailSender", () => ({
  mailSender: jest.fn().mockResolvedValue({
    messageId: "mock-message-id-12345",
    response: "250 OK: Message received"
  })
}));

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Owner = require("../../MemberCrud/Models/Owner");
const OTP = require("../Models/Otp");

// Import the mocked mailSender for verification in tests
const { mailSender } = require("../../../../Utils/mailSender");

let app;
let server;

beforeAll(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    app = require("../server");
    
    // If server exports a server instance, capture it
    if (app.server) {
      server = app.server;
    }
  } catch (error) {
    console.error("Test setup error:", error);
    throw error;
  }
});

beforeEach(async () => {
  try {
    // Clean up test users and OTPs before each test
    await Owner.deleteMany({ email: { $regex: /test.*@gmail\.com/ } });
    await OTP.deleteMany({ email: { $regex: /test.*@gmail\.com/ } });
    
    // Clear the mock calls
    mailSender.mockClear();
  } catch (error) {
    console.error("Test cleanup error:", error);
  }
});

afterAll(async () => {
  try {
    // Final cleanup
    await Owner.deleteMany({ email: { $regex: /test.*@gmail\.com/ } });
    await OTP.deleteMany({ email: { $regex: /test.*@gmail\.com/ } });
    
    // Close server if exists
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
    
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    // Give processes time to cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error("Test teardown error:", error);
  }
});

describe("Auth API", () => {
  // Use timestamp to ensure unique emails for each test run
  const getTestUser = (suffix = '') => ({
    firstName: "Test",
    lastName: "User",
    mobileNumber: "9999999999",
    email: `test${suffix}${Date.now()}@gmail.com`,
    password: "123456",
    confirmPassword: "123456"
  });

  describe("POST /api/v1/auth/signup", () => {
    it("should send OTP for new user registration", async () => {
      const testUser = getTestUser('1');
      
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("OTP sent successfully");
      expect(res.body.userData).toBeDefined();
      expect(res.body.userData.email).toBe(testUser.email);

      // Verify that mailSender was called
      expect(mailSender).toHaveBeenCalledWith(
        testUser.email,
        "Your OTP for Signup - Gym Management",
        expect.any(String)
      );

      // Verify OTP was saved in database
      const savedOTP = await OTP.findOne({ email: testUser.email });
      expect(savedOTP).toBeTruthy();
      expect(savedOTP.otp).toBeDefined();
    });

    it("should not send OTP for existing user", async () => {
      const testUser = getTestUser('2');
      
      // First complete registration (send OTP + verify)
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      // Get OTP from database to verify
      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      // Complete registration by verifying OTP
      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      // Try to signup again with same email
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User already exists");
    });

    it("should not send OTP with invalid data", async () => {
      const invalidUser = {
        firstName: "",
        lastName: "",
        mobileNumber: "",
        email: "invalid-email",
        password: "123", // Too short
        confirmPassword: "456" // Doesn't match
      };

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(invalidUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      // Check for validation errors from express-validator
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    // FIXED: This test now expects express-validator errors instead of controller message
    it("should not send OTP with missing required fields", async () => {
      const incompleteUser = {
        firstName: "Test",
        lastName: "User"
        // Missing email, password, etc.
      };

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(incompleteUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      // Express-validator returns errors array, not the controller message
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
      
      // Check that validation errors include missing fields
      const errorMessages = res.body.errors.map(err => err.msg);
      expect(errorMessages).toContain("Mobile number is required");
      expect(errorMessages).toContain("Please provide a valid email");
      expect(errorMessages).toContain("Password must be at least 6 characters long");
    });

    // FIXED: This test now expects express-validator errors instead of controller message
    it("should not send OTP when passwords don't match", async () => {
      const testUser = getTestUser('mismatch');
      testUser.confirmPassword = "differentpassword";

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      // Express-validator handles password mismatch, not controller
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      
      const errorMessages = res.body.errors.map(err => err.msg);
      expect(errorMessages).toContain("Passwords do not match");
    });

    it("should replace existing OTP if user tries to signup again before verification", async () => {
      const testUser = getTestUser('replace');
      
      // First signup request
      const res1 = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(res1.statusCode).toBe(200);
      
      // Get first OTP
      const firstOTP = await OTP.findOne({ email: testUser.email });
      expect(firstOTP).toBeTruthy();

      // Second signup request (should replace OTP)
      const res2 = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.message).toBe("OTP sent successfully");

      // Verify only one OTP exists for this email
      const otpCount = await OTP.countDocuments({ email: testUser.email });
      expect(otpCount).toBe(1);

      // Verify mailSender was called twice
      expect(mailSender).toHaveBeenCalledTimes(2);
    });
  });

  describe("POST /api/v1/auth/verify-otp", () => {
    let validOTP;
    let testUser;

    beforeEach(async () => {
      testUser = getTestUser('otp');
      
      // Send OTP first
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      // Get the OTP from database
      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      validOTP = otpDoc.otp;
    });

    it("should complete registration with valid OTP", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: validOTP
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User registered successfully");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.headers['set-cookie']).toBeDefined();

      // Verify user was created in database
      const createdUser = await Owner.findOne({ email: testUser.email });
      expect(createdUser).toBeTruthy();

      // Verify OTP was deleted after successful verification
      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).toBeNull();
    });

    it("should not verify with invalid OTP", async () => {
      const testUserInvalid = getTestUser('invalid');
      
      // Create OTP for this user first
      await request(app)
        .post("/api/v1/auth/signup")
        .send(testUserInvalid);

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUserInvalid,
          otp: "123456" // Wrong OTP
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });

    // FIXED: This test now expects express-validator errors instead of controller message
    it("should not verify with missing OTP", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          mobileNumber: testUser.mobileNumber,
          email: testUser.email,
          password: testUser.password
          // Missing OTP
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      // Express-validator handles missing OTP validation
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      
      const errorMessages = res.body.errors.map(err => err.msg);
      expect(errorMessages).toContain("OTP must be exactly 6 digits");
    });
  });

  describe("POST /api/v1/auth/resend-otp", () => {
    it("should resend OTP for valid email", async () => {
      const testUser = getTestUser('resend');
      
      // First send initial OTP
      await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({
          email: testUser.email,
          firstName: testUser.firstName
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("New OTP sent to your email");

      // Verify that mailSender was called
      expect(mailSender).toHaveBeenCalledWith(
        testUser.email,
        "Your OTP for Signup - Gym Management",
        expect.any(String)
      );

      // Verify new OTP was saved in database
      const savedOTP = await OTP.findOne({ email: testUser.email });
      expect(savedOTP).toBeTruthy();
    });

    it("should not resend OTP for existing user", async () => {
      const testUser = getTestUser('resendexist');
      
      // Complete registration first
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      // Try to resend OTP for existing user
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({
          email: testUser.email,
          firstName: testUser.firstName
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User already exists");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      testUser = getTestUser('login');
      
      // Complete registration (signup + verify OTP) before each login test
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      const verifyRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      expect(verifyRes.statusCode).toBe(201);
    });

    it("should login the owner successfully", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.user).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it("should not login with wrong password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword"
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Incorrect password");
    });

    it("should not login non-existent user", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: `nonexistent${Date.now()}@gmail.com`,
          password: "123456"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("User not registered");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    let authCookie;
    let testUser;

    beforeEach(async () => {
      testUser = getTestUser('me');
      
      // Complete registration (signup + verify OTP) and login to get auth cookie
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      const verifyRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      expect(verifyRes.statusCode).toBe(201);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password
        });

      authCookie = loginRes.headers['set-cookie'].find(cookie => 
        cookie.startsWith('token=')
      );
    });

    it("should get current user with valid token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
    });

    it("should not get current user without token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me");

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/auth/logout", () => {
    it("should logout successfully", async () => {
      const res = await request(app)
        .get("/api/v1/auth/logout");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Logged out successfully");
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    let testUser;

    beforeEach(async () => {
      testUser = getTestUser('forgot');
      
      // Complete registration before each forgot password test
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      const verifyRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      expect(verifyRes.statusCode).toBe(201);
    });

    it("should send reset link for existing user", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: testUser.email
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Reset link sent to your email");
      
      // Verify that mailSender was called
      expect(mailSender).toHaveBeenCalledWith(
        testUser.email,
        "Reset Your Password - Gym Management",
        expect.any(String)
      );
    });

    it("should not send reset link for non-existent user", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: `nonexistent${Date.now()}@gmail.com`
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Owner does not exist");
    });

    it("should not accept invalid email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "invalid-email"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should not accept missing email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/reset-password/:token", () => {
    let validToken;
    let testUser;

    beforeEach(async () => {
      testUser = getTestUser('reset');
      
      // Complete registration before each reset password test
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(signupRes.statusCode).toBe(200);

      const otpDoc = await OTP.findOne({ email: testUser.email });
      expect(otpDoc).not.toBeNull();
      
      const verifyRes = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          ...testUser,
          otp: otpDoc.otp
        });

      expect(verifyRes.statusCode).toBe(201);

      // Generate a valid token
      validToken = jwt.sign(
        { email: testUser.email }, 
        process.env.JWT_SECRET, 
        { expiresIn: "15m" }
      );
    });

    it("should reset password with valid token and matching passwords", async () => {
      const newPassword = "newpassword123";
      
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${validToken}`)
        .send({
          newPassword: newPassword,
          confirmPassword: newPassword
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Password has been reset successfully");

      // Verify that mailSender was called for success email
      expect(mailSender).toHaveBeenCalledWith(
        testUser.email,
        "Password Reset Successful - Gym Management",
        expect.any(String)
      );

      // Verify the new password works by trying to login
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: newPassword
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it("should not reset password with invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password/invalid-token")
        .send({
          newPassword: "newpassword123",
          confirmPassword: "newpassword123"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired token");
    });

    it("should not reset password with expired token", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "-1s" } // Expired 1 second ago
      );

      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${expiredToken}`)
        .send({
          newPassword: "newpassword123",
          confirmPassword: "newpassword123"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid or expired token");
    });

    it("should not reset password when passwords don't match", async () => {
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${validToken}`)
        .send({
          newPassword: "newpassword123",
          confirmPassword: "differentpassword"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should not reset password with short password", async () => {
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${validToken}`)
        .send({
          newPassword: "123",
          confirmPassword: "123"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should not reset password with missing fields", async () => {
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${validToken}`)
        .send({
          newPassword: "newpassword123"
          // Missing confirmPassword
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should not reset password for non-existent user", async () => {
      // Create token for non-existent user
      const nonExistentToken = jwt.sign(
        { email: `nonexistent${Date.now()}@gmail.com` },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${nonExistentToken}`)
        .send({
          newPassword: "newpassword123",
          confirmPassword: "newpassword123"
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Owner not found");
    });
  });
});