// migration.js - Run this once to fix existing data
const mongoose = require("mongoose");
require("dotenv").config();

async function migrateSubscriptionData() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to database for migration...");
    
    // 1. Update all users with subscriptionPlan "FREE" to "NONE"
    const result = await mongoose.connection.db.collection('owners').updateMany(
      { subscriptionPlan: "FREE" },
      { $set: { subscriptionPlan: "NONE" } }
    );
    
    console.log(`Updated ${result.modifiedCount} users from FREE to NONE`);
    
    // 2. Update users who don't have subscriptionPlan field (undefined)
    const result2 = await mongoose.connection.db.collection('owners').updateMany(
      { subscriptionPlan: { $exists: false } },
      { $set: { subscriptionPlan: "NONE", subscriptionExpiry: null } }
    );
    
    console.log(`Updated ${result2.modifiedCount} users with missing subscription fields`);
    
    // 3. Fix duplicate key index issue for phoneNo
    console.log("\n🔧 Fixing phoneNo index...");
    
    // Get all existing indexes first
    const existingIndexes = await mongoose.connection.db.collection('members').indexes();
    console.log("Existing indexes:", existingIndexes.map(idx => idx.name));
    
    try {
      // Drop the existing phoneNo index if it exists
      await mongoose.connection.db.collection('members').dropIndex("phoneNo_1");
      console.log("✅ Dropped existing phoneNo_1 index");
    } catch (error) {
      console.log("ℹ️  phoneNo_1 index doesn't exist or already dropped");
    }
    
    try {
      // Drop existing compound index if it exists
      await mongoose.connection.db.collection('members').dropIndex("ownerId_1_phoneNo_1");
      console.log("✅ Dropped existing ownerId_1_phoneNo_1 index");
    } catch (error) {
      console.log("ℹ️  ownerId_1_phoneNo_1 index doesn't exist or already dropped");
    }
    
    // Create compound unique index for ownerId + phoneNo
    await mongoose.connection.db.collection('members').createIndex(
      { "ownerId": 1, "phoneNo": 1 }, 
      { unique: true, name: "ownerId_phoneNo_unique" }
    );
    console.log("✅ Created compound unique index: ownerId_phoneNo_unique");
    
    // 4. Verify the migration
    const noneCount = await mongoose.connection.db.collection('owners').countDocuments({ subscriptionPlan: "NONE" });
    const basicCount = await mongoose.connection.db.collection('owners').countDocuments({ subscriptionPlan: "BASIC" });
    
    console.log(`\n📊 Migration Results:`);
    console.log(`- Users with NONE: ${noneCount}`);
    console.log(`- Users with BASIC: ${basicCount}`);
    
    // 5. List all indexes on members collection to verify
    const indexes = await mongoose.connection.db.collection('members').indexes();
    console.log("\n📋 Current indexes on members collection:");
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    await mongoose.connection.close();
    console.log("\n🎉 Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

// Run migration
migrateSubscriptionData();