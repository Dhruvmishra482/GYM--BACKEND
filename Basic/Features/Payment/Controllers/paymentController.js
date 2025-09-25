console.log("💳 [DEBUG] PaymentController: Loading payment controller...");

const Razorpay = require("razorpay");
const crypto = require("crypto");
const Owner = require("../../MemberCrud/Models/Owner");

console.log("💳 [DEBUG] PaymentController: Basic imports loaded");

// Import mail utilities with error handling
let mailSender, paymentSuccessTemplate, paymentFailureTemplate, welcomePremiumTemplate;
try {
  ({ mailSender } = require("../../../../Utils/mailSender"));
  console.log("✅ [DEBUG] PaymentController: mailSender loaded");
} catch (error) {
  console.error("❌ [DEBUG] PaymentController: Failed to load mailSender:", error.message);
}

try {
  ({ 
    paymentSuccessTemplate, 
    paymentFailureTemplate, 
    welcomePremiumTemplate 
  } = require("../../../../Templates/paymentTemplate"));
  console.log("✅ [DEBUG] PaymentController: Email templates loaded");
} catch (error) {
  console.error("❌ [DEBUG] PaymentController: Failed to load email templates:", error.message);
}

// Initialize Razorpay instance with debug
let razorpay;
try {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ [DEBUG] PaymentController: Razorpay keys missing in environment");
  } else {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log("✅ [DEBUG] PaymentController: Razorpay initialized successfully");
  }
} catch (error) {
  console.error("❌ [DEBUG] PaymentController: Failed to initialize Razorpay:", error.message);
}

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: "Basic",
    tagline: "Start Your Gym Journey", 
    description: "Perfect for small gyms and personal trainers who want to digitize and automate their operations.",
    monthlyAmount: 399,
    yearlyAmount: 3990,
    currency: "INR",
    monthlyDuration: 30,
    yearlyDuration: 365,
    features: [
      "Up to 150 members",
      "AI-powered member insights", 
      "Smart payment reminders (WhatsApp)",
      "Member dashboard with profiles",
      "24/7 chat & email support",
      "Search active members",
      "Add new members manually",
      "Basic analytics reports",
      "Due notifications to owner",
      "Single location support"
    ],
    savings: "Save ₹798 yearly"
  }
};

console.log("✅ [DEBUG] PaymentController: Subscription plans configured");

// FIXED: Initiate payment process with billing cycle support
exports.initiatePayment = async (req, res) => {
  console.log("🎯 [DEBUG] PaymentController: initiatePayment called");
  console.log("📋 [DEBUG] PaymentController: Request body:", req.body);
  console.log("👤 [DEBUG] PaymentController: User ID:", req.user?.id);
  
  try {
    const { plan, billing = "monthly" } = req.body;

    console.log("🔍 [DEBUG] PaymentController: Extracted plan:", plan, "billing:", billing);

    const userId = req.user.id;

    // Validate plan
    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      console.log("❌ [DEBUG] PaymentController: Invalid plan:", plan);
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan selected"
      });
    }

    // Validate billing cycle
    if (!["monthly", "yearly"].includes(billing)) {
      console.log("❌ [DEBUG] PaymentController: Invalid billing cycle:", billing);
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be 'monthly' or 'yearly'"
      });
    }

    console.log("✅ [DEBUG] PaymentController: Validation passed");

    // Get user details
    console.log("🔍 [DEBUG] PaymentController: Finding user with ID:", userId);
    const user = await Owner.findById(userId);
    if (!user) {
      console.log("❌ [DEBUG] PaymentController: User not found:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("✅ [DEBUG] PaymentController: User found:", user.email);

    // Check if user is already on this plan or higher
    if (user.subscriptionPlan === plan && user.hasActiveSubscription()) {
      console.log("❌ [DEBUG] PaymentController: User already has active subscription:", plan);
      return res.status(400).json({
        success: false,
        message: `You already have an active ${plan} subscription`
      });
    }

    const selectedPlan = SUBSCRIPTION_PLANS[plan];
    const amount = billing === "yearly" ? selectedPlan.yearlyAmount : selectedPlan.monthlyAmount;
    const duration = billing === "yearly" ? selectedPlan.yearlyDuration : selectedPlan.monthlyDuration;
    
    console.log("💰 [DEBUG] PaymentController: Calculated amount:", amount, "duration:", duration);

    // Create Razorpay order
    const orderOptions = {
      amount: amount * 100, // Convert to paise
      currency: selectedPlan.currency,
      receipt: `ord_${userId.slice(-8)}_${Date.now()}`,
      notes: {
        userId: userId,
        plan: plan,
        billing: billing,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`
      }
    };

    console.log("🔍 [DEBUG] PaymentController: Creating Razorpay order with options:", orderOptions);

    if (!razorpay) {
      console.error("❌ [DEBUG] PaymentController: Razorpay not initialized");
      return res.status(500).json({
        success: false,
        message: "Payment service not available"
      });
    }

    const order = await razorpay.orders.create(orderOptions);

    if (!order) {
      console.log("❌ [DEBUG] PaymentController: Failed to create Razorpay order");
      return res.status(500).json({
        success: false,
        message: "Failed to create payment order"
      });
    }

    console.log("✅ [DEBUG] PaymentController: Razorpay order created:", order.id);

    // Save order details temporarily
    user.paymentHistory.push({
      orderId: order.id,
      amount: amount,
      currency: selectedPlan.currency,
      billing: billing,
      status: "PENDING",
      plan: plan
    });
    await user.save();

    console.log("✅ [DEBUG] PaymentController: Payment history updated for user");

    const responseData = {
      orderId: order.id,
      amount: amount,
      currency: selectedPlan.currency,
      planName: selectedPlan.name,
      billing: billing,
      duration: duration,
      key: process.env.RAZORPAY_KEY_ID,
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        contact: user.mobileNumber
      }
    };

    console.log("✅ [DEBUG] PaymentController: Sending successful response");
    return res.status(200).json({
      success: true,
      message: "Payment order created successfully",
      data: responseData
    });

  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: initiatePayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate payment process"
    });
  }
};

// Verify payment and update subscription
exports.verifyPayment = async (req, res) => {
  console.log("🎯 [DEBUG] PaymentController: verifyPayment called");
  console.log("📋 [DEBUG] PaymentController: Request body:", req.body);

  try {
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature 
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      console.log("❌ [DEBUG] PaymentController: Missing payment verification details");
      return res.status(400).json({
        success: false,
        message: "Missing payment verification details"
      });
    }

    console.log("🔍 [DEBUG] PaymentController: Verifying signature...");

    // Create signature for verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    // Verify signature
    if (expectedSignature !== razorpay_signature) {
      console.log("❌ [DEBUG] PaymentController: Signature verification failed");
      // FIXED: Use exports instead of this
      await exports.handlePaymentFailure(razorpay_order_id, "Invalid payment signature");
      
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature."
      });
    }

    console.log("✅ [DEBUG] PaymentController: Signature verified successfully");

    // FIXED: Use exports instead of this
    const result = await exports.handlePaymentSuccess(
      razorpay_payment_id, 
      razorpay_order_id, 
      req.user.id
    );

    if (result.success) {
      console.log("✅ [DEBUG] PaymentController: Payment success handled");
      return res.status(200).json({
        success: true,
        message: "Payment verified and subscription activated successfully",
        data: {
          user: result.user,
          subscription: result.subscription
        }
      });
    } else {
      console.log("❌ [DEBUG] PaymentController: Payment success handling failed:", result.message);
      return res.status(500).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: verifyPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
};

// FIXED: Handle successful payment with billing cycle support
exports.handlePaymentSuccess = async (paymentId, orderId, userId) => {
  console.log("🎯 [DEBUG] PaymentController: handlePaymentSuccess called");
  console.log("📋 [DEBUG] PaymentController: paymentId:", paymentId, "orderId:", orderId, "userId:", userId);

  try {
    // Find user and the payment record
    const user = await Owner.findById(userId);
    if (!user) {
      console.log("❌ [DEBUG] PaymentController: User not found in handlePaymentSuccess");
      throw new Error("User not found");
    }

    console.log("✅ [DEBUG] PaymentController: User found for payment success");

    // Find the payment record
    const paymentRecord = user.paymentHistory.find(
      payment => payment.orderId === orderId
    );

    if (!paymentRecord) {
      console.log("❌ [DEBUG] PaymentController: Payment record not found for order:", orderId);
      throw new Error("Payment record not found");
    }

    console.log("✅ [DEBUG] PaymentController: Payment record found:", paymentRecord.plan, paymentRecord.billing);

    // Calculate subscription expiry date based on billing cycle
    const plan = paymentRecord.plan;
    const billing = paymentRecord.billing || "monthly";
    const selectedPlan = SUBSCRIPTION_PLANS[plan];
    
    if (!selectedPlan) {
      console.log("❌ [DEBUG] PaymentController: Invalid subscription plan:", plan);
      throw new Error("Invalid subscription plan");
    }

    const duration = billing === "yearly" ? selectedPlan.yearlyDuration : selectedPlan.monthlyDuration;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    console.log("📅 [DEBUG] PaymentController: Calculated expiry date:", expiryDate);

    // Update user subscription
    user.subscriptionPlan = plan;
    user.subscriptionExpiry = expiryDate;

    // Update payment record
    paymentRecord.paymentId = paymentId;
    paymentRecord.status = "SUCCESS";

    await user.save();

    console.log("✅ [DEBUG] PaymentController: User subscription updated successfully");

    // Send success email
    if (mailSender && paymentSuccessTemplate && welcomePremiumTemplate) {
      try {
        const planName = selectedPlan.name;
        const amount = billing === "yearly" ? selectedPlan.yearlyAmount : selectedPlan.monthlyAmount;
        
        await mailSender(
          user.email,
          `Payment Successful - ${planName}`,
          paymentSuccessTemplate(
            `${user.firstName} ${user.lastName}`,
            `${planName} (${billing === "yearly" ? "Yearly" : "Monthly"})`,
            amount,
            orderId,
            expiryDate
          )
        );

        await mailSender(
          user.email,
          `Welcome to ${planName} - Iron Throne Gym`,
          welcomePremiumTemplate(`${user.firstName} ${user.lastName}`, planName)
        );

        console.log("✅ [DEBUG] PaymentController: Success emails sent");
      } catch (emailError) {
        console.error("❌ [DEBUG] PaymentController: Email sending error:", emailError);
      }
    } else {
      console.log("⚠️ [DEBUG] PaymentController: Email services not available, skipping emails");
    }

    const result = {
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry
      },
      subscription: user.getSubscriptionStatus()
    };

    console.log("✅ [DEBUG] PaymentController: Returning success result");
    return result;

  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: handlePaymentSuccess error:", error);
    return {
      success: false,
      message: error.message
    };
  }
};

// FIXED: Handle failed payment with billing cycle support
exports.handlePaymentFailure = async (orderId, reason = "Payment processing failed") => {
  console.log("🎯 [DEBUG] PaymentController: handlePaymentFailure called");
  console.log("📋 [DEBUG] PaymentController: orderId:", orderId, "reason:", reason);

  try {
    // Find user with this order
    const user = await Owner.findOne({
      "paymentHistory.orderId": orderId
    });

    if (!user) {
      console.error("❌ [DEBUG] PaymentController: User not found for failed payment:", orderId);
      return { success: false, message: "User not found" };
    }

    console.log("✅ [DEBUG] PaymentController: User found for payment failure");

    // Find and update payment record
    const paymentRecord = user.paymentHistory.find(
      payment => payment.orderId === orderId
    );

    if (paymentRecord) {
      paymentRecord.status = "FAILED";
      await user.save();

      console.log("✅ [DEBUG] PaymentController: Payment record marked as failed");

      // Send failure email
      if (mailSender && paymentFailureTemplate) {
        try {
          const selectedPlan = SUBSCRIPTION_PLANS[paymentRecord.plan];
          const planName = selectedPlan?.name || "Subscription Plan";
          const billing = paymentRecord.billing || "monthly";
          const amount = billing === "yearly" ? selectedPlan?.yearlyAmount : selectedPlan?.monthlyAmount || 0;
          
          await mailSender(
            user.email,
            `Payment Failed - ${planName}`,
            paymentFailureTemplate(
              `${user.firstName} ${user.lastName}`,
              `${planName} (${billing === "yearly" ? "Yearly" : "Monthly"})`,
              amount,
              orderId,
              reason
            )
          );

          console.log("✅ [DEBUG] PaymentController: Failure email sent");
        } catch (emailError) {
          console.error("❌ [DEBUG] PaymentController: Failure email error:", emailError);
        }
      } else {
        console.log("⚠️ [DEBUG] PaymentController: Email services not available for failure notification");
      }
    }

    return { success: true, message: "Payment failure handled" };

  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: handlePaymentFailure error:", error);
    return { success: false, message: error.message };
  }
};

// Get subscription plans
exports.getSubscriptionPlans = async (req, res) => {
  console.log("🎯 [DEBUG] PaymentController: getSubscriptionPlans called");

  try {
    const plans = Object.keys(SUBSCRIPTION_PLANS).map(key => ({
      id: key,
      name: SUBSCRIPTION_PLANS[key].name,
      tagline: SUBSCRIPTION_PLANS[key].tagline,
      description: SUBSCRIPTION_PLANS[key].description,
      monthlyAmount: SUBSCRIPTION_PLANS[key].monthlyAmount,
      yearlyAmount: SUBSCRIPTION_PLANS[key].yearlyAmount,
      currency: SUBSCRIPTION_PLANS[key].currency,
      monthlyDuration: SUBSCRIPTION_PLANS[key].monthlyDuration,
      yearlyDuration: SUBSCRIPTION_PLANS[key].yearlyDuration,
      features: SUBSCRIPTION_PLANS[key].features,
      savings: SUBSCRIPTION_PLANS[key].savings
    }));

    console.log("✅ [DEBUG] PaymentController: Returning subscription plans:", plans.length);

    return res.status(200).json({
      success: true,
      message: "Subscription plans retrieved successfully",
      data: { 
        plans,
        note: "Currently only Basic plan is available. Advanced and Enterprise plans coming in 3-4 days!"
      }
    });
  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: getSubscriptionPlans error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription plans"
    });
  }
};

// Get user's subscription status
exports.getSubscriptionStatus = async (req, res) => {
  console.log("🎯 [DEBUG] PaymentController: getSubscriptionStatus called");
  console.log("👤 [DEBUG] PaymentController: User ID:", req.user?.id);

  try {
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      console.log("❌ [DEBUG] PaymentController: User not found for subscription status");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("✅ [DEBUG] PaymentController: User found, getting subscription status");

    const subscriptionStatus = user.getSubscriptionStatus();
    
    console.log("📋 [DEBUG] PaymentController: Subscription status:", subscriptionStatus);

    return res.status(200).json({
      success: true,
      message: "Subscription status retrieved successfully",
      data: {
        subscription: subscriptionStatus,
        paymentHistory: user.paymentHistory.slice(-5)
      }
    });
  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: getSubscriptionStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription status"
    });
  }
};

// Webhook for Razorpay events
exports.webhookHandler = async (req, res) => {
  console.log("🎯 [DEBUG] PaymentController: webhookHandler called");
  console.log("📋 [DEBUG] PaymentController: Webhook body:", req.body);

  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        console.log("❌ [DEBUG] PaymentController: Invalid webhook signature");
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature"
        });
      }
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;
    
    console.log("🔍 [DEBUG] PaymentController: Processing webhook event:", event);

    switch (event) {
      case 'payment.captured':
        console.log("✅ [DEBUG] PaymentController: Payment captured:", paymentEntity.id);
        break;
        
      case 'payment.failed':
        console.log("❌ [DEBUG] PaymentController: Payment failed webhook");
        // FIXED: Use exports instead of this
        await exports.handlePaymentFailure(
          paymentEntity.order_id, 
          paymentEntity.error_description || "Payment failed"
        );
        break;
        
      default:
        console.log("ℹ️ [DEBUG] PaymentController: Unhandled webhook event:", event);
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("❌ [DEBUG] PaymentController: webhookHandler error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed"
    });
  }
};

console.log("✅ [DEBUG] PaymentController: All exports defined successfully");