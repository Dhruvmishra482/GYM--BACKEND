// config/planConfig.js - Updated with flexible billing options

const PLAN_CONFIG = {
  NONE: {
    name: "No Subscription",
    monthlyPrice: 0,
    quarterlyPrice: 0,
    halfYearlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      members: 0,
      whatsappReminders: 0,
      analyticsViews: 0,
      searchQueries: 0
    },
    features: ["No active features"],
    available: false
  },
  BASIC: {
    name: "Basic",
    tagline: "Start Your Gym Journey",
    description: "Perfect for small gyms and personal trainers who want to digitize and automate their operations.",
    // Flexible pricing structure
    pricing: {
      monthly: {
        price: 399,
        duration: 1,
        savings: 0,
        popular: false
      },
      quarterly: {
        price: 1097, // 399 * 3 - 10% discount
        duration: 3,
        savings: 100,
        popular: false
      },
      "half-yearly": {
        price: 2095, // 399 * 6 - 15% discount
        duration: 6,
        savings: 299,
        popular: true
      },
      yearly: {
        price: 3990, // 399 * 12 - 20% discount  
        duration: 12,
        savings: 798,
        popular: false
      }
    },
    // Legacy support for existing code
    monthlyPrice: 399,
    quarterlyPrice: 1097,
    halfYearlyPrice: 2095,
    yearlyPrice: 3990,
    limits: {
      members: 150,
      whatsappReminders: 1000,
      analyticsViews: 500,
      searchQueries: 1000
    },
    features: [
      { name: "Up to 150 members", included: true, highlight: false },
      { name: "Member dashboard with profiles & photos", included: true, highlight: false },
      { name: "Add & search active members", included: true, highlight: false },
      { name: "Due notifications to owner", included: true, highlight: true },
      { name: "Basic fee tracking & payment status", included: true, highlight: false },
      { name: "Member contact details & emergency info", included: true, highlight: false },
      { name: "Basic analytics reports", included: true, highlight: false },
      { name: "Data backup & security", included: true, highlight: false },
      { name: "24/7 chat & email support", included: true, highlight: false }
    ],
    color: "from-cyan-400 via-blue-500 to-purple-600",
    glowColor: "cyan",
    available: true
  },
  ADVANCED: {
    name: "Advanced", 
    tagline: "Scale Your Fitness Business",
    description: "For growing gyms that want automation, smart reminders, and advanced reporting.",
    pricing: {
      monthly: {
        price: 699,
        duration: 1,
        savings: 0,
        popular: false
      },
      quarterly: {
        price: 1897, // 699 * 3 - 10% discount
        duration: 3,
        savings: 200,
        popular: false
      },
      "half-yearly": {
        price: 3595, // 699 * 6 - 15% discount
        duration: 6,
        savings: 599,
        popular: true
      },
      yearly: {
        price: 6990, // 699 * 12 - 20% discount
        duration: 12,
        savings: 1398,
        popular: false
      }
    },
    // Legacy support
    monthlyPrice: 699,
    quarterlyPrice: 1897,
    halfYearlyPrice: 3595,
    yearlyPrice: 6990,
    limits: {
      members: 400,
      whatsappReminders: 5000,
      analyticsViews: 2000,
      searchQueries: 5000
    },
    features: [
      { name: "Up to 400 members", included: true, highlight: false },
      { name: "Powered by every feature of the Basic Plan, and more", included: true, highlight: true },
      { name: "Automated WhatsApp notifications", included: true, highlight: true },
      { name: "Predictive fee tracking & insights", included: true, highlight: true },
      { name: "Inactive member alerts (track who hasn't visited)", included: true, highlight: true },
      { name: "Advanced analytics (growth + revenue trends)", included: true, highlight: true },
      { name: "AI Diet Plan based on progress & attendance", included: true, highlight: true },
      { name: "Basic AI workout recommendations", included: true, highlight: true },
      { name: "Bulk WhatsApp messaging for announcements", included: true, highlight: true },
      { name: "Equipment maintenance reminders", included: true, highlight: false },
      { name: "Expense tracking (basic)", included: true, highlight: false },
      { name: "Priority phone + chat support", included: true, highlight: false }
    ],
    color: "from-orange-400 via-red-500 to-pink-600",
    glowColor: "orange",
    available: true
  },
  ENTERPRISE: {
    name: "Enterprise",
    tagline: "For fitness empires that want AI + automation at the highest level",
    description: "Everything in Advanced Plan plus the most powerful tools to run multiple gyms, maximize member engagement, and boost revenue.",
    pricing: {
      monthly: {
        price: 999,
        duration: 1,
        savings: 0,
        popular: false
      },
      quarterly: {
        price: 2697, // 999 * 3 - 10% discount
        duration: 3,
        savings: 300,
        popular: false
      },
      "half-yearly": {
        price: 5095, // 999 * 6 - 15% discount
        duration: 6,
        savings: 899,
        popular: true
      },
      yearly: {
        price: 9990, // 999 * 12 - 20% discount
        duration: 12,
        savings: 1998,
        popular: false
      }
    },
    // Legacy support
    monthlyPrice: 999,
    quarterlyPrice: 2697,
    halfYearlyPrice: 5095,
    yearlyPrice: 9990,
    limits: {
      members: -1, // Unlimited
      whatsappReminders: -1,
      analyticsViews: -1,
      searchQueries: -1
    },
    features: [
      { name: "Unlimited members (no cap)", included: true, highlight: true },
      { name: "Powered by every feature of the Advanced Plan, and more", included: true, highlight: true },
      { name: "Manage multiple branches/locations from one dashboard", included: true, highlight: true },
      { name: "Automated daily WhatsApp reports (joins, renewals, dues, inactive)", included: true, highlight: true },
      { name: "Smart WhatsApp fee reminders (3 days before + due date with QR)", included: true, highlight: true },
      { name: "AI-powered crowd prediction & time-slot optimization", included: true, highlight: true },
      { name: "Member birthday & anniversary notifications", included: true, highlight: false },
      { name: "Advanced AI workout plans with progress tracking", included: true, highlight: true },
      { name: "Personalized nutrition tracking with meal suggestions", included: true, highlight: true },
      { name: "Full inactive/old member history with re-activation campaigns", included: true, highlight: true },
      { name: "Advanced expense & profit tracking", included: true, highlight: true },
      { name: "Automated class scheduling & booking system", included: true, highlight: true },
      { name: "Advanced security & compliance features", included: true, highlight: true },
      { name: "Dedicated success manager (priority WhatsApp + phone support)", included: true, highlight: true },
      { name: "Early access to new premium features", included: true, highlight: true }
    ],
    color: "from-purple-400 via-pink-500 to-red-500",
    glowColor: "purple",
    available: true
  }
};

// Helper functions for flexible billing
const BILLING_CYCLES = {
  monthly: {
    label: "Monthly",
    duration: 1,
    suffix: "/mo"
  },
  quarterly: {
    label: "3 Months", 
    duration: 3,
    suffix: "/3mo"
  },
  "half-yearly": {
    label: "6 Months",
    duration: 6, 
    suffix: "/6mo"
  },
  yearly: {
    label: "12 Months",
    duration: 12,
    suffix: "/yr"
  }
};

// Get price for a plan and billing cycle
const getPlanPrice = (planKey, billingCycle = 'monthly') => {
  const plan = PLAN_CONFIG[planKey];
  if (!plan || !plan.pricing) return 0;
  
  return plan.pricing[billingCycle]?.price || plan.monthlyPrice || 0;
};

// Get savings for a billing cycle compared to monthly
const getBillingSavings = (planKey, billingCycle) => {
  const plan = PLAN_CONFIG[planKey];
  if (!plan || !plan.pricing) return 0;
  
  return plan.pricing[billingCycle]?.savings || 0;
};

// Get duration for billing cycle
const getBillingDuration = (billingCycle) => {
  return BILLING_CYCLES[billingCycle]?.duration || 1;
};

// Get formatted billing label
const getBillingLabel = (billingCycle) => {
  return BILLING_CYCLES[billingCycle]?.label || "Monthly";
};

module.exports = {
  PLAN_CONFIG,
  BILLING_CYCLES,
  getPlanPrice,
  getBillingSavings, 
  getBillingDuration,
  getBillingLabel
};