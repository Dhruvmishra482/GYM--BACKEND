require("dotenv").config();
jest.setTimeout(60000);

// Mock external dependencies
jest.mock("../../../../Utils/mailSender", () => ({
  mailSender: jest.fn().mockResolvedValue({
    messageId: "mock-payment-email-id",
    response: "250 OK: Payment email sent"
  })
}));

// Mock Razorpay
jest.mock("razorpay", () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: "order_test_12345",
        amount: 39900,
        currency: "INR",
        receipt: "test_receipt",
        status: "created"
      })
    }
  }));
});

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Owner = require("../../MemberCrud/Models/Owner");
const OTP = require("../../Auth/Models/Otp");
const { mailSender } = require("../../../../Utils/mailSender");

let app;
let server;
let testUser;
let userToken;
let userId;

beforeAll(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    app = require("../../../../server");
    
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
    // Clean up test data
    await Owner.deleteMany({ email: { $regex: /testpayment.*@gmail\.com/ } });
    await OTP.deleteMany({ email: { $regex: /testpayment.*@gmail\.com/ } });
    
    // Clear mocks
    mailSender.mockClear();
    
    // Create and register a test user for payment tests
    testUser = {
      firstName: "Payment",
      lastName: "Test",
      mobileNumber: "8888888888",
      email: `testpayment${Date.now()}@gmail.com`,
      password: "123456",
      confirmPassword: "123456"
    };
    
    // Complete user registration flow
    await request(app)
      .post("/api/v1/auth/signup")
      .send(testUser);
    
    const otpDoc = await OTP.findOne({ email: testUser.email });
    
    await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({
        ...testUser,
        otp: otpDoc.otp
      });
    
    // Extract user ID and token for authenticated requests
    const user = await Owner.findOne({ email: testUser.email });
    userId = user._id;
    userToken = jwt.sign(
      { id: userId, email: testUser.email, role: "owner" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
  } catch (error) {
    console.error("Test user setup error:", error);
  }
});

afterAll(async () => {
  try {
    await Owner.deleteMany({ email: { $regex: /testpayment.*@gmail\.com/ } });
    await OTP.deleteMany({ email: { $regex: /testpayment.*@gmail\.com/ } });
    
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error("Test teardown error:", error);
  }
});

describe("Payment System API", () => {

  describe("GET /api/v1/payment/plans", () => {
    it("should return available subscription plans", async () => {
      const res = await request(app)
        .get("/api/v1/payment/plans");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans).toBeDefined();
      expect(Array.isArray(res.body.data.plans)).toBe(true);
      expect(res.body.data.plans.length).toBeGreaterThan(0);
      
      const basicPlan = res.body.data.plans.find(plan => plan.id === "BASIC");
      expect(basicPlan).toBeDefined();
      expect(basicPlan.monthlyAmount).toBe(399);
      expect(basicPlan.yearlyAmount).toBe(3990);
      expect(basicPlan.features).toBeDefined();
      expect(Array.isArray(basicPlan.features)).toBe(true);
      expect(basicPlan.name).toBe("Basic");
    });
  });

  describe("POST /api/v1/payment/initiate", () => {
    it("should create payment order for authenticated user", async () => {
      const res = await request(app)
        .post("/api/v1/payment/initiate")
        .set("Cookie", `token=${userToken}`)
        .send({
          plan: "BASIC",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.amount).toBe(399);
      expect(res.body.data.currency).toBe("INR");
      expect(res.body.data.planName).toBe("Basic");
      expect(res.body.data.billing).toBe("monthly");
      expect(res.body.data.key).toBeDefined();
      
      // Verify payment record saved in database
      const user = await Owner.findById(userId);
      expect(user.paymentHistory.length).toBe(1);
      expect(user.paymentHistory[0].status).toBe("PENDING");
      expect(user.paymentHistory[0].plan).toBe("BASIC");
      expect(user.paymentHistory[0].billing).toBe("monthly");
    });

    it("should create yearly payment order with correct amount", async () => {
      const res = await request(app)
        .post("/api/v1/payment/initiate")
        .set("Cookie", `token=${userToken}`)
        .send({
          plan: "BASIC",
          billing: "yearly"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.amount).toBe(3990);
      expect(res.body.data.billing).toBe("yearly");
    });

    it("should not allow payment initiation without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/payment/initiate")
        .send({
          plan: "BASIC",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Access denied");
    });

    it("should not allow invalid plan selection", async () => {
      const res = await request(app)
        .post("/api/v1/payment/initiate")
        .set("Cookie", `token=${userToken}`)
        .send({
          plan: "INVALID_PLAN",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("should not allow duplicate active subscription", async () => {
      // First, manually set user to have active subscription
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .post("/api/v1/payment/initiate")
        .set("Cookie", `token=${userToken}`)
        .send({
          plan: "BASIC",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already have an active");
    });
  });

  describe("POST /api/v1/payment/verify", () => {
    let orderId;

    beforeEach(async () => {
      // Create a payment order first
      const orderRes = await request(app)
        .post("/api/v1/payment/initiate")
        .set("Cookie", `token=${userToken}`)
        .send({
          plan: "BASIC",
          billing: "monthly"
        });
      
      orderId = orderRes.body.data.orderId;
    });

    it("should verify valid payment and update subscription", async () => {
      const paymentId = "pay_test_12345";
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const res = await request(app)
        .post("/api/v1/payment/verify")
        .set("Cookie", `token=${userToken}`)
        .send({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.subscription).toBeDefined();

      // Verify user subscription updated in database
      const updatedUser = await Owner.findById(userId);
      expect(updatedUser.subscriptionPlan).toBe("BASIC");
      expect(updatedUser.subscriptionExpiry).toBeDefined();
      expect(new Date(updatedUser.subscriptionExpiry)).toBeInstanceOf(Date);
      
      // Verify payment history updated
      const paymentRecord = updatedUser.paymentHistory.find(p => p.orderId === orderId);
      expect(paymentRecord.status).toBe("SUCCESS");
      expect(paymentRecord.paymentId).toBe(paymentId);

      // Verify success email was sent
      expect(mailSender).toHaveBeenCalledWith(
        testUser.email,
        expect.stringContaining("Payment Successful"),
        expect.any(String)
      );
    });

    it("should reject payment with invalid signature", async () => {
      const paymentId = "pay_test_12345";
      const invalidSignature = "invalid_signature_123";

      const res = await request(app)
        .post("/api/v1/payment/verify")
        .set("Cookie", `token=${userToken}`)
        .send({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: invalidSignature
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("verification failed");

      // Verify user subscription not updated
      const user = await Owner.findById(userId);
      expect(user.subscriptionPlan).toBe("NONE");
    });

    it("should not verify payment without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/payment/verify")
        .send({
          razorpay_payment_id: "pay_test_12345",
          razorpay_order_id: orderId,
          razorpay_signature: "test_signature"
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not verify payment with missing parameters", async () => {
      const res = await request(app)
        .post("/api/v1/payment/verify")
        .set("Cookie", `token=${userToken}`)
        .send({
          razorpay_payment_id: "pay_test_12345"
          // Missing order_id and signature
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("GET /api/v1/payment/status", () => {
    it("should return subscription status for user with no subscription", async () => {
      const res = await request(app)
        .get("/api/v1/payment/status")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.isActive).toBe(false);
      expect(res.body.data.subscription.plan).toBe("NONE");
      expect(res.body.data.subscription.needsSubscription).toBe(true);
    });

    it("should return subscription status for user with active subscription", async () => {
      // Set user to have active subscription
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: expiryDate
      });

      const res = await request(app)
        .get("/api/v1/payment/status")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.isActive).toBe(true);
      expect(res.body.data.subscription.plan).toBe("BASIC");
      expect(res.body.data.subscription.needsSubscription).toBe(false);
      expect(res.body.data.subscription.daysLeft).toBeGreaterThan(25);
    });

    it("should auto-downgrade expired subscription", async () => {
      // Set user to have expired subscription
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: expiredDate
      });

      const res = await request(app)
        .get("/api/v1/payment/status")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.subscription.isActive).toBe(false);
      expect(res.body.data.subscription.plan).toBe("NONE");
      expect(res.body.data.subscription.needsSubscription).toBe(true);

      // Verify database was updated
      const user = await Owner.findById(userId);
      expect(user.subscriptionPlan).toBe("NONE");
      expect(user.subscriptionExpiry).toBeNull();
    });

    it("should not return status without authentication", async () => {
      const res = await request(app)
        .get("/api/v1/payment/status");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

describe("Subscription Protected Routes", () => {
  describe("Member Management Protection", () => {
    it("should block member access without subscription", async () => {
      const res = await request(app)
        .get("/api/v1/member/allmembers")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.subscriptionRequired).toBe(true);
      expect(res.body.needsSubscription).toBe(true);
      expect(res.body.currentPlan).toBe("NONE");
    });

    it("should allow member access with active subscription", async () => {
      // Set user to have active subscription
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .get("/api/v1/member/allmembers")
        .set("Cookie", `token=${userToken}`);

      // Should not be blocked by subscription (might fail for other reasons like no members)
      expect(res.statusCode).not.toBe(403);
      expect(res.body.subscriptionRequired).not.toBe(true);
    });

    it("should block add member without subscription", async () => {
      const memberData = {
        name: "Test Member",
        phoneNo: "9999999999",
        feesAmount: 1000,
        nextDueDate: "2025-02-01",
        address: "Test Address"
      };

      const res = await request(app)
        .post("/api/v1/member/addmember")
        .set("Cookie", `token=${userToken}`)
        .send(memberData);

      expect(res.statusCode).toBe(403);
      expect(res.body.subscriptionRequired).toBe(true);
      expect(res.body.needsSubscription).toBe(true);
    });
  });

  describe("Dashboard Status Protection", () => {
    it("should return upgrade message for user without subscription", async () => {
      const res = await request(app)
        .get("/api/v1/owner/dashboard-status")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.hasAccess).toBe(false);
      expect(res.body.needsSubscription).toBe(true);
      expect(res.body.upgradeMessage).toBeDefined();
      expect(res.body.features).toBeDefined();
      expect(Array.isArray(res.body.features)).toBe(true);
    });

    it("should return dashboard access for subscribed user", async () => {
      // Set user to have active subscription
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .get("/api/v1/owner/dashboard-status")
        .set("Cookie", `token=${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.hasAccess).toBe(true);
      expect(res.body.needsSubscription).toBe(false);
      expect(res.body.currentPlan).toBe("BASIC");
    });
  });
});