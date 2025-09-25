// debug-twilio.js - Create this file in your project root directory
require('dotenv').config(); // Load environment variables
const twilio = require("twilio");

const debugTwilioCredentials = async () => {
  console.log("🔍 Debugging Twilio Credentials...");
  
  // Check environment variables
  console.log("📋 Environment Variables Check:");
  console.log("- TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID ? `Present (${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...)` : "❌ Missing");
  console.log("- TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? `Present (${process.env.TWILIO_AUTH_TOKEN.substring(0, 10)}...)` : "❌ Missing");
  console.log("- TWILIO_WHATSAPP_NUMBER:", process.env.TWILIO_WHATSAPP_NUMBER || "❌ Missing");

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error("❌ Missing required Twilio credentials!");
    return;
  }

  try {
    // Test basic authentication
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    console.log("\n🔐 Testing Twilio Authentication...");
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log("✅ Authentication successful!");
    console.log("📊 Account Status:", account.status);
    console.log("📊 Account Type:", account.type);
    
    // Test WhatsApp sender number
    console.log("\n📱 Testing WhatsApp Sender Number...");
    const phoneNumbers = await client.incomingPhoneNumbers.list();
    const whatsappNumbers = phoneNumbers.filter(num => 
      num.phoneNumber === process.env.TWILIO_WHATSAPP_NUMBER
    );
    
    if (whatsappNumbers.length > 0) {
      console.log("✅ WhatsApp number found in account");
      console.log("📊 Number capabilities:", whatsappNumbers[0].capabilities);
    } else {
      console.log("⚠️ WhatsApp number not found in your Twilio account");
      console.log("🔍 Available numbers:", phoneNumbers.map(n => n.phoneNumber));
    }
    
  } catch (error) {
    console.error("❌ Twilio Authentication Failed:", error.message);
    console.error("🔍 Error Code:", error.code);
    console.error("📖 More Info:", error.moreInfo);
    
    if (error.code === 20003) {
      console.error("\n🚨 AUTHENTICATION ERROR SOLUTIONS:");
      console.error("1. Check your .env file for correct TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
      console.error("2. Verify credentials at: https://console.twilio.com/");
      console.error("3. Make sure Account SID starts with 'AC'");
      console.error("4. Regenerate Auth Token if needed");
    }
  }
};

// Run the debug function
debugTwilioCredentials();