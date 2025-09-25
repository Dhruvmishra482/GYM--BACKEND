require("dotenv").config();
jest.setTimeout(60000);

// Mock external dependencies
jest.mock("../utils/mailSender", () => ({
  mailSender: jest.fn().mockResolvedValue({
    messageId: "mock-subscription-email-id",
    response: "250 OK: Subscription email sent"
  })
}));

jest.mock("../../../../Utils/mailSender", () => jest.fn().mockResolvedValue({
  success: true,
  messageId: "mock-whatsapp-id"
}));

const request = require("supertest");
const mongoose = require("mongoose");
const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");
const OTP = require("../../Auth/Models/Otp");
const { mailSender } = require("../../../../Utils/mailSender");

let app;
let server;
let testUser;
let authCookie;
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
    await Owner.deleteMany({ email: { $regex: /testsub.*@gmail\.com/ } });
    await Member.deleteMany({ phoneNo: { $regex: /^999.*/ } });
    await OTP.deleteMany({ email: { $regex: /testsub.*@gmail\.com/ } });
    
    // Clear mocks
    mailSender.mockClear();
    
    // Create and register test user
    testUser = {
      firstName: "Sub",
      lastName: "Test",
      mobileNumber: "7777777777",
      email: `testsub${Date.now()}@gmail.com`,
      password: "123456",
      confirmPassword: "123456"
    };
    
    // Complete registration flow (signup + verify OTP)
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
    
    // PROPER LOGIN FLOW - Get real auth cookie
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    // Extract auth cookie from login response
    authCookie = loginRes.headers['set-cookie'].find(cookie => 
      cookie.startsWith('token=')
    );
    
    // Get user ID for tests
    const user = await Owner.findOne({ email: testUser.email });
    userId = user._id;
    
  } catch (error) {
    console.error("Test user setup error:", error);
  }
});

afterAll(async () => {
  try {
    await Owner.deleteMany({ email: { $regex: /testsub.*@gmail\.com/ } });
    await Member.deleteMany({ phoneNo: { $regex: /^999.*/ } });
    await OTP.deleteMany({ email: { $regex: /testsub.*@gmail\.com/ } });
    
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

describe("Subscription System & Member Limits", () => {

  describe("Subscription Details", () => {
    it("should return subscription details for user with no plan", async () => {
      const res = await request(app)
        .get("/api/v1/subscription/details")
        .set("Cookie", authCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.plan).toBe("NONE");
      expect(res.body.data.subscription.isActive).toBe(false);
      expect(res.body.data.usage.members.current).toBe(0);
      expect(res.body.data.limits.members).toBe(0);
    });

    it("should return subscription details for user with active plan", async () => {
      // Manually set user to BASIC plan
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const res = await request(app)
        .get("/api/v1/subscription/details")
        .set("Cookie", authCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.subscription.plan).toBe("BASIC");
      expect(res.body.data.subscription.isActive).toBe(true);
      expect(res.body.data.limits.members).toBe(150);
      expect(res.body.data.limits.whatsappReminders).toBe(1000);
    });
  });

  describe("Member Limit Enforcement", () => {
    beforeEach(async () => {
      // Set user to BASIC plan for member limit tests
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'usageStats.membersCount': 0
      });
    });

    it("should allow adding member within limit", async () => {
      const memberData = {
        name: "Test Member 1",
        phoneNo: "9991234567",
        feesAmount: 1000,
        nextDueDate: "2025-02-15",
        address: "Test Address"
      };

      const res = await request(app)
        .post("/api/v1/member/addmember")
        .set("Cookie", authCookie)
        .send(memberData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify member count updated
      const user = await Owner.findById(userId);
      expect(user.usageStats.membersCount).toBe(1);
    });

    it("should block adding member when limit reached", async () => {
      // Set member count to limit (150)
      await Owner.findByIdAndUpdate(userId, {
        'usageStats.membersCount': 150
      });

      const memberData = {
        name: "Test Member 151",
        phoneNo: "9991234568",
        feesAmount: 1000,
        nextDueDate: "2025-02-15",
        address: "Test Address"
      };

      const res = await request(app)
        .post("/api/v1/member/addmember")
        .set("Cookie", authCookie)
        .send(memberData);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Member limit reached");
      expect(res.body.limitReached).toBe(true);
      expect(res.body.upgradeRequired).toBe(true);
    });

    it("should allow adding member after upgrade", async () => {
      // Set to limit first
      await Owner.findByIdAndUpdate(userId, {
        'usageStats.membersCount': 150
      });

      // Upgrade to ADVANCED plan
      const upgradeRes = await request(app)
        .post("/api/v1/subscription/upgrade")
        .set("Cookie", authCookie)
        .send({
          targetPlan: "ADVANCED",
          billing: "monthly",
          paymentId: "test_payment_123",
          orderId: "test_order_123"
        });

      expect(upgradeRes.statusCode).toBe(200);

      // Now try adding member
      const memberData = {
        name: "Test Member 151",
        phoneNo: "9991234569",
        feesAmount: 1000,
        nextDueDate: "2025-02-15",
        address: "Test Address"
      };

      const res = await request(app)
        .post("/api/v1/member/addmember")
        .set("Cookie", authCookie)
        .send(memberData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify member count preserved after upgrade
      const user = await Owner.findById(userId);
      expect(user.usageStats.membersCount).toBe(151);
      expect(user.subscriptionPlan).toBe("ADVANCED");
    });
  });

  describe("Feature Usage Limits", () => {
    beforeEach(async () => {
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'usageStats.featureUsage.whatsappReminders.count': 0,
        'usageStats.featureUsage.analyticsViews.count': 0
      });
    });

    it("should track and allow WhatsApp reminders within limit", async () => {
      const res = await request(app)
        .post("/api/v1/subscription/track-usage")
        .set("Cookie", authCookie)
        .send({
          feature: "whatsappReminders"
        });

      expect(res.statusCode).toBe(200);

      // Verify usage tracked
      const user = await Owner.findById(userId);
      expect(user.usageStats.featureUsage.whatsappReminders.count).toBe(1);
    });

    it("should block WhatsApp reminders when limit reached", async () => {
      // Set usage to limit
      await Owner.findByIdAndUpdate(userId, {
        'usageStats.featureUsage.whatsappReminders.count': 1000
      });

      const res = await request(app)
        .post("/api/v1/subscription/check-limit")
        .set("Cookie", authCookie)
        .send({
          action: "whatsappReminders",
          count: 1
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.canPerform).toBe(false);
      expect(res.body.data.upgradeRequired).toBe(true);
    });

    it("should track analytics views within limit", async () => {
      const res = await request(app)
        .post("/api/v1/subscription/track-usage")
        .set("Cookie", authCookie)
        .send({
          feature: "analyticsViews"
        });

      expect(res.statusCode).toBe(200);

      const user = await Owner.findById(userId);
      expect(user.usageStats.featureUsage.analyticsViews.count).toBe(1);
    });
  });

  describe("Plan Upgrade Process", () => {
    beforeEach(async () => {
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days left
        'usageStats.membersCount': 140
      });
    });

    it("should calculate upgrade price with prorated discount", async () => {
      const res = await request(app)
        .post("/api/v1/subscription/calculate-upgrade")
        .set("Cookie", authCookie)
        .send({
          targetPlan: "ADVANCED",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.pricing.originalPrice).toBeDefined();
      expect(res.body.data.pricing.proratedDiscount).toBeGreaterThan(0);
      expect(res.body.data.pricing.finalPrice).toBeLessThan(res.body.data.pricing.originalPrice);
    });

    it("should process upgrade with early renewal logic", async () => {
      const currentExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      await Owner.findByIdAndUpdate(userId, {
        subscriptionExpiry: currentExpiry
      });

      const res = await request(app)
        .post("/api/v1/subscription/upgrade")
        .set("Cookie", authCookie)
        .send({
          targetPlan: "ADVANCED",
          billing: "monthly",
          paymentId: "test_payment_456",
          orderId: "test_order_456"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      
      const user = await Owner.findById(userId);
      expect(user.subscriptionPlan).toBe("ADVANCED");
      expect(user.usageStats.membersCount).toBe(140); // Preserved
      expect(new Date(user.subscriptionExpiry) > currentExpiry).toBe(true); // Extended
    });
  });

  describe("Usage Analytics", () => {
    beforeEach(async () => {
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'usageStats.membersCount': 135,
        'usageStats.featureUsage.whatsappReminders.count': 850,
        'usageStats.featureUsage.analyticsViews.count': 400
      });
    });

    it("should return usage analytics with warnings", async () => {
      const res = await request(app)
        .get("/api/v1/subscription/analytics")
        .set("Cookie", authCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.currentUsage.members.used).toBe(135);
      expect(res.body.data.currentUsage.members.limit).toBe(150);
    //   expect(res.body.data.currentUsage.members.percentage).toBeGreaterThan(90);
    // Change from:
// To:
expect(res.body.data.currentUsage.members.percentage).toBeGreaterThanOrEqual(90);
      
      // Should have warnings for high usage
      expect(res.body.data.warnings.length).toBeGreaterThan(0);
      expect(res.body.data.warnings[0].type).toBe("members");
    });
  });

  describe("Billing Cycle Management", () => {
    it("should handle custom billing cycles correctly", async () => {
      // Set user with custom billing cycle (15th to 15th)
      const startDate = new Date("2025-01-15");
      const nextResetDate = new Date("2025-02-15");
      
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "BASIC",
        subscriptionExpiry: nextResetDate,
        'billingCycle.startDate': startDate,
        'billingCycle.nextResetDate': nextResetDate,
        'billingCycle.billingDay': 15,
        'usageStats.featureUsage.whatsappReminders.count': 500
      });

      // Call billing cycle reset
      const res = await request(app)
        .post("/api/v1/subscription/reset-billing-cycles");

      expect(res.statusCode).toBe(200);

      // Verify usage reset only if cycle ended
      const user = await Owner.findById(userId);
      if (new Date() >= nextResetDate) {
        expect(user.usageStats.featureUsage.whatsappReminders.count).toBe(0);
      }
    });
  });

  describe("Essential Error Cases", () => {
    it("should require authentication for subscription details", async () => {
      const res = await request(app)
        .get("/api/v1/subscription/details");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should handle invalid plan upgrade", async () => {
      const res = await request(app)
        .post("/api/v1/subscription/upgrade")
        .set("Cookie", authCookie)
        .send({
          targetPlan: "INVALID_PLAN",
          billing: "monthly"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should handle member addition without subscription", async () => {
      // Reset user to no subscription
      await Owner.findByIdAndUpdate(userId, {
        subscriptionPlan: "NONE",
        subscriptionExpiry: null
      });

      const memberData = {
        name: "Test Member",
        phoneNo: "9991234570",
        feesAmount: 1000,
        nextDueDate: "2025-02-15",
        address: "Test Address"
      };

      const res = await request(app)
        .post("/api/v1/member/addmember")
        .set("Cookie", authCookie)
        .send(memberData);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});