require("dotenv").config();
jest.setTimeout(60000);

// Mock Twilio service
// jest.mock("../../../../Utils/sendWhatsapp", () => ({
//   sendWhatsapp: jest.fn().mockResolvedValue({
//     success: true,
//     sid: "mock_whatsapp_message_id",
//     status: "sent",
//     to: "+919465737989"
//   })
// }));
jest.mock('../../../../Utils/sendWhatsapp', () => ({
  sendWhatsapp: jest.fn((phone, message) => 
    Promise.resolve({ 
      success: true,
      sid: 'mock-sid-123',
      status: 'sent',
      to: phone,
      from: '+1234567890'
    })
  ),
  testTwilioSetup: jest.fn()
}));

// Then in your test, get the mocked function
const { sendWhatsapp } = require('../../../../Utils/sendWhatsapp');
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Owner = require("../../../../Basic/Features/MemberCrud/Models/Owner");
const Member = require("../../../../Basic/Features/MemberCrud/Models/Member");
const DietPlan = require("../models/dietPlanSchema");
const OTP = require("../../../../Basic/Features/Auth/Models/Otp");


let app;
let server;
let testOwner;
let ownerToken;
let ownerId;
let testMembers = [];

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
    await Owner.deleteMany({ email: { $regex: /testdiet.*@gmail\.com/ } });
    await Member.deleteMany({ email: { $regex: /testmember.*@gmail\.com/ } });
    await DietPlan.deleteMany({});
    await OTP.deleteMany({ email: { $regex: /testdiet.*@gmail\.com/ } });
    
    // Clear mocks
    sendWhatsapp.mockClear();
    
    // Create and register test owner
    testOwner = {
      firstName: "Diet",
      lastName: "Owner",
      mobileNumber: "9999999999",
      email: `testdiet${Date.now()}@gmail.com`,
      password: "123456",
      confirmPassword: "123456"
    };
    
    // Complete owner registration
    await request(app)
      .post("/api/v1/auth/signup")
      .send(testOwner);
    
    const otpDoc = await OTP.findOne({ email: testOwner.email });
    
    await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({
        ...testOwner,
        otp: otpDoc.otp
      });
    
    // Get owner and set subscription
    const owner = await Owner.findOne({ email: testOwner.email });
    ownerId = owner._id;
    
    // Set ADVANCED subscription for diet plan feature
    await Owner.findByIdAndUpdate(ownerId, {
      subscriptionPlan: "ADVANCED",
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    
    ownerToken = jwt.sign(
      { id: ownerId, email: testOwner.email, role: "owner" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    // Create test members
    for (let i = 1; i <= 3; i++) {
      const member = await Member.create({
        ownerId: ownerId,
        name: `Test Member ${i}`,
        phoneNo: `999999999${i}`,
        age: 25 + i,
        gender: i % 2 === 0 ? "Male" : "Female",
        email: `testmember${i}${Date.now()}@gmail.com`,
        feesAmount: 2000,
        address: `Test Address ${i}`,
        paymentStatus: "Paid"
      });
      testMembers.push(member);
    }
    
  } catch (error) {
    console.error("Test setup error:", error);
  }
});

afterAll(async () => {
  try {
    await Owner.deleteMany({ email: { $regex: /testdiet.*@gmail\.com/ } });
    await Member.deleteMany({ email: { $regex: /testmember.*@gmail\.com/ } });
    await DietPlan.deleteMany({});
    await OTP.deleteMany({ email: { $regex: /testdiet.*@gmail\.com/ } });
    
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

describe("Diet Plan API", () => {

  describe("POST /api/v1/diet-plan/create", () => {
    it("should create diet plan with valid data", async () => {
      const dietPlanData = {
        planTitle: "Weight Loss Plan",
        planType: "Weight Loss",
        targetAudience: "All Members",
        planDuration: "1 month",
        mealPlan: {
          breakfast: {
            time: "8:00 AM",
            items: ["Oats with milk", "2 boiled eggs", "Green tea"],
            notes: "High protein breakfast"
          },
          lunch: {
            time: "1:00 PM",
            items: ["Grilled chicken breast", "Brown rice", "Salad"],
            notes: "Balanced lunch"
          },
          dinner: {
            time: "8:00 PM",
            items: ["Fish curry", "Roti", "Vegetables"],
            notes: "Light dinner"
          }
        },
        generalInstructions: "Drink plenty of water throughout the day",
        dosList: ["Exercise daily", "Sleep 7-8 hours", "Track your meals"],
        dontsList: ["Skip meals", "Eat junk food", "Stay up late"],
        waterIntake: "3-4 liters daily"
      };

      const res = await request(app)
        .post("/api/v1/diet-plan/create")
        .set("Cookie", `token=${ownerToken}`)
        .send(dietPlanData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.planTitle).toBe("Weight Loss Plan");
      expect(res.body.data.status).toBe("Draft");
      expect(res.body.data.ownerId.toString()).toBe(ownerId.toString());
    });

    it("should not create diet plan without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/diet-plan/create")
        .send({
          planTitle: "Test Plan",
          mealPlan: {}
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not create diet plan with missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/diet-plan/create")
        .set("Cookie", `token=${ownerToken}`)
        .send({
          planType: "Weight Loss"
          // Missing planTitle and mealPlan
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/diet-plan/all", () => {
    beforeEach(async () => {
      // Create some test diet plans
      await DietPlan.create([
        {
          ownerId: ownerId,
          planTitle: "Plan 1",
          planType: "Weight Loss",
          mealPlan: { breakfast: { items: ["Test"] } },
          status: "Active"
        },
        {
          ownerId: ownerId,
          planTitle: "Plan 2",
          planType: "Muscle Building",
          mealPlan: { lunch: { items: ["Test"] } },
          status: "Draft"
        }
      ]);
    });

    it("should get all diet plans for authenticated owner", async () => {
      const res = await request(app)
        .get("/api/v1/diet-plan/all")
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it("should filter diet plans by status", async () => {
      const res = await request(app)
        .get("/api/v1/diet-plan/all?status=Active")
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe("Active");
    });
  });

  describe("POST /api/v1/diet-plan/:planId/broadcast", () => {
    let dietPlan;

    beforeEach(async () => {
      // Create a test diet plan
      dietPlan = await DietPlan.create({
        ownerId: ownerId,
        planTitle: "Broadcast Test Plan",
        planType: "General Health",
        targetAudience: "All Members",
        planDuration: "1 month",
        mealPlan: {
          breakfast: {
            time: "8:00 AM",
            items: ["Oats", "Fruits", "Milk"],
            notes: "Healthy breakfast"
          },
          lunch: {
            time: "1:00 PM",
            items: ["Rice", "Dal", "Vegetables"],
            notes: "Balanced lunch"
          },
          dinner: {
            time: "8:00 PM",
            items: ["Soup", "Salad", "Grilled chicken"],
            notes: "Light dinner"
          }
        },
        generalInstructions: "Follow this plan consistently",
        dosList: ["Exercise regularly", "Stay hydrated"],
        dontsList: ["Skip meals", "Eat junk food"],
        waterIntake: "3-4 liters",
        status: "Draft"
      });
    });

    it("should broadcast diet plan to all members successfully", async () => {
      const res = await request(app)
        .post(`/api/v1/diet-plan/${dietPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({
          filterGender: "All",
          filterStatus: "All"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalMembers).toBe(3);
      expect(res.body.data.successfulDeliveries).toBe(3);
      expect(res.body.data.failedDeliveries).toBe(0);

      // Verify WhatsApp service was called
      expect(sendWhatsapp).toHaveBeenCalledTimes(3);

      // Verify diet plan status updated
      const updatedPlan = await DietPlan.findById(dietPlan._id);
      expect(updatedPlan.status).toBe("Active");
      expect(updatedPlan.broadcastDetails.totalMembersSent).toBe(3);
      expect(updatedPlan.deliveryLog.length).toBe(3);
    });

    it("should filter members by gender during broadcast", async () => {
      const res = await request(app)
        .post(`/api/v1/diet-plan/${dietPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({
          filterGender: "Male",
          filterStatus: "All"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalMembers).toBe(1); // Only 1 male member
      expect(sendWhatsapp).toHaveBeenCalledTimes(1);
    });

    it("should handle broadcast with no members found", async () => {
      // Delete all members
      await Member.deleteMany({ ownerId: ownerId });

      const res = await request(app)
        .post(`/api/v1/diet-plan/${dietPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({});

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("No members found");
    });

    it("should not broadcast without authentication", async () => {
      const res = await request(app)
        .post(`/api/v1/diet-plan/${dietPlan._id}/broadcast`)
        .send({});

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/diet-plan/:planId/preview", () => {
    let dietPlan;

    beforeEach(async () => {
      dietPlan = await DietPlan.create({
        ownerId: ownerId,
        planTitle: "Preview Test Plan",
        planType: "Weight Gain",
        mealPlan: {
          breakfast: { time: "8:00 AM", items: ["Test breakfast"] }
        },
        status: "Draft"
      });
    });

    it("should preview diet plan message", async () => {
      const res = await request(app)
        .get(`/api/v1/diet-plan/${dietPlan._id}/preview`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.characterCount).toBeGreaterThan(0);
      expect(res.body.data.estimatedSMS).toBeGreaterThan(0);
   expect(res.body.data.message).toContain("PREVIEW TEST PLAN");
    });
  });

  describe("GET /api/v1/diet-plan/:planId/stats", () => {
    let dietPlan;

    beforeEach(async () => {
      dietPlan = await DietPlan.create({
        ownerId: ownerId,
        planTitle: "Stats Test Plan",
        planType: "Maintenance",
        mealPlan: { breakfast: { items: ["Test"] } },
        status: "Active",
        broadcastDetails: {
          totalMembersSent: 10,
          successfulDeliveries: 8,
          failedDeliveries: 2,
          lastBroadcastAt: new Date()
        }
      });
    });

    it("should get delivery statistics for diet plan", async () => {
      const res = await request(app)
        .get(`/api/v1/diet-plan/${dietPlan._id}/stats`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalSent).toBe(10);
      expect(res.body.data.successful).toBe(8);
      expect(res.body.data.failed).toBe(2);
      expect(res.body.data.successRate).toBe("80.00");
    });
  });

  describe("DELETE /api/v1/diet-plan/:planId", () => {
    let dietPlan;

    beforeEach(async () => {
      dietPlan = await DietPlan.create({
        ownerId: ownerId,
        planTitle: "Delete Test Plan",
        planType: "Custom",
        mealPlan: { breakfast: { items: ["Test"] } },
        status: "Draft"
      });
    });

    it("should delete diet plan successfully", async () => {
      const res = await request(app)
        .delete(`/api/v1/diet-plan/${dietPlan._id}`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("deleted successfully");

      // Verify plan deleted from database
      const deletedPlan = await DietPlan.findById(dietPlan._id);
      expect(deletedPlan).toBeNull();
    });

    it("should not delete non-existent diet plan", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .delete(`/api/v1/diet-plan/${fakeId}`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

});