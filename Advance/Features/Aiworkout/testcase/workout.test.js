require("dotenv").config();
jest.setTimeout(60000);

// Mock Twilio service
jest.mock("../../../../Utils/twilioService", () => ({
  sendWhatsapp: jest.fn().mockResolvedValue({
    success: true,
    sid: "mock_whatsapp_message_id",
    status: "sent",
    to: "+919999999999"
  })
}));

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");
const WorkoutPlan = require("../Models/workoutPlanSchema");
const OTP = require("../../Auth/Models/Otp");
const { sendWhatsapp } = require("../../../../Utils/twilioService");

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
    await Owner.deleteMany({ email: { $regex: /testworkout.*@gmail\.com/ } });
    await Member.deleteMany({ email: { $regex: /testmember.*@gmail\.com/ } });
    await WorkoutPlan.deleteMany({});
    await OTP.deleteMany({ email: { $regex: /testworkout.*@gmail\.com/ } });
    
    sendWhatsapp.mockClear();
    
    // Create test owner
    testOwner = {
      firstName: "Workout",
      lastName: "Owner",
      mobileNumber: "9999999999",
      email: `testworkout${Date.now()}@gmail.com`,
      password: "123456",
      confirmPassword: "123456"
    };
    
    await request(app).post("/api/v1/auth/signup").send(testOwner);
    const otpDoc = await OTP.findOne({ email: testOwner.email });
    await request(app).post("/api/v1/auth/verify-otp").send({ ...testOwner, otp: otpDoc.otp });
    
    const owner = await Owner.findOne({ email: testOwner.email });
    ownerId = owner._id;
    
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
    await Owner.deleteMany({ email: { $regex: /testworkout.*@gmail\.com/ } });
    await Member.deleteMany({ email: { $regex: /testmember.*@gmail\.com/ } });
    await WorkoutPlan.deleteMany({});
    await OTP.deleteMany({ email: { $regex: /testworkout.*@gmail\.com/ } });
    
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => server.close(() => resolve()));
    }
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error("Test teardown error:", error);
  }
});

describe("Workout Plan API - Essential Tests", () => {

  describe("POST /api/v1/workout-plan/create", () => {
    it("should create workout plan with valid data", async () => {
      const workoutPlanData = {
        planTitle: "Beginner Strength Training",
        planType: "Strength Training",
        difficultyLevel: "Beginner",
        workoutsPerWeek: 4,
        weeklySchedule: {
          monday: {
            restDay: false,
            focus: "Chest & Triceps",
            exercises: [
              { name: "Bench Press", sets: 3, reps: "8-12", rest: "90 seconds" },
              { name: "Push-ups", sets: 3, reps: "12-15", rest: "60 seconds" }
            ]
          },
          wednesday: {
            restDay: true
          }
        },
        importantTips: ["Always warm up", "Stay hydrated"]
      };

      const res = await request(app)
        .post("/api/v1/workout-plan/create")
        .set("Cookie", `token=${ownerToken}`)
        .send(workoutPlanData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planTitle).toBe("Beginner Strength Training");
      expect(res.body.data.status).toBe("Draft");
    });

    it("should not create workout plan without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/workout-plan/create")
        .send({ planTitle: "Test", weeklySchedule: {} });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/workout-plan/all", () => {
    beforeEach(async () => {
      await WorkoutPlan.create([
        {
          ownerId: ownerId,
          planTitle: "Strength Plan",
          planType: "Strength Training",
          weeklySchedule: { monday: { restDay: false, exercises: [{ name: "Test", sets: 3, reps: "10" }] } },
          status: "Active"
        },
        {
          ownerId: ownerId,
          planTitle: "Cardio Plan",
          planType: "Cardio Focus",
          weeklySchedule: { tuesday: { restDay: false, exercises: [{ name: "Running", sets: 1, reps: "30 min" }] } },
          status: "Draft"
        }
      ]);
    });

    it("should get all workout plans", async () => {
      const res = await request(app)
        .get("/api/v1/workout-plan/all")
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it("should filter by status", async () => {
      const res = await request(app)
        .get("/api/v1/workout-plan/all?status=Active")
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe("Active");
    });
  });

  describe("POST /api/v1/workout-plan/:planId/broadcast", () => {
    let workoutPlan;

    beforeEach(async () => {
      workoutPlan = await WorkoutPlan.create({
        ownerId: ownerId,
        planTitle: "Broadcast Test Plan",
        planType: "General Fitness",
        weeklySchedule: {
          monday: {
            restDay: false,
            focus: "Full Body",
            exercises: [
              { name: "Squats", sets: 4, reps: "10", rest: "90 sec" },
              { name: "Push-ups", sets: 3, reps: "12", rest: "60 sec" }
            ]
          },
          wednesday: { restDay: true }
        },
        importantTips: ["Warm up properly", "Cool down after workout"],
        status: "Draft"
      });
    });

    it("should broadcast workout plan to all members", async () => {
      const res = await request(app)
        .post(`/api/v1/workout-plan/${workoutPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({ filterGender: "All", filterStatus: "All" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMembers).toBe(3);
      expect(res.body.data.successfulDeliveries).toBe(3);
      expect(sendWhatsapp).toHaveBeenCalledTimes(3);

      const updatedPlan = await WorkoutPlan.findById(workoutPlan._id);
      expect(updatedPlan.status).toBe("Active");
      expect(updatedPlan.broadcastDetails.totalMembersSent).toBe(3);
    });

    it("should filter by gender", async () => {
      const res = await request(app)
        .post(`/api/v1/workout-plan/${workoutPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({ filterGender: "Male" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.totalMembers).toBe(1);
    });

    it("should handle no members found", async () => {
      await Member.deleteMany({ ownerId: ownerId });

      const res = await request(app)
        .post(`/api/v1/workout-plan/${workoutPlan._id}/broadcast`)
        .set("Cookie", `token=${ownerToken}`)
        .send({});

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain("No members found");
    });
  });

  describe("GET /api/v1/workout-plan/:planId/preview", () => {
    let workoutPlan;

    beforeEach(async () => {
      workoutPlan = await WorkoutPlan.create({
        ownerId: ownerId,
        planTitle: "Preview Test",
        planType: "Strength Training",
        weeklySchedule: {
          monday: { restDay: false, focus: "Chest", exercises: [{ name: "Bench Press", sets: 3, reps: "10" }] }
        }
      });
    });

    it("should preview workout plan message", async () => {
      const res = await request(app)
        .get(`/api/v1/workout-plan/${workoutPlan._id}/preview`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.message).toContain("Preview Test");
      expect(res.body.data.characterCount).toBeGreaterThan(0);
    });
  });

  describe("DELETE /api/v1/workout-plan/:planId", () => {
    let workoutPlan;

    beforeEach(async () => {
      workoutPlan = await WorkoutPlan.create({
        ownerId: ownerId,
        planTitle: "Delete Test",
        planType: "General Fitness",
        weeklySchedule: { monday: { restDay: false, exercises: [{ name: "Test", sets: 3, reps: "10" }] } }
      });
    });

    it("should delete workout plan", async () => {
      const res = await request(app)
        .delete(`/api/v1/workout-plan/${workoutPlan._id}`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedPlan = await WorkoutPlan.findById(workoutPlan._id);
      expect(deletedPlan).toBeNull();
    });

    it("should return 404 for non-existent plan", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .delete(`/api/v1/workout-plan/${fakeId}`)
        .set("Cookie", `token=${ownerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

});