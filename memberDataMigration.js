// memberDataMigration.js - Run this to fix existing member data
const mongoose = require("mongoose");
require("dotenv").config();

async function migrateMemberData() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to database for member data migration...");
    
    // Get all owners
    const owners = await mongoose.connection.db.collection('owners').find({}).toArray();
    console.log(`Found ${owners.length} owners in the system`);
    
    if (owners.length === 0) {
      console.log("No owners found. Please ensure owners are created first.");
      return;
    }
    
    // Get all members without ownerId
    const membersWithoutOwner = await mongoose.connection.db.collection('members').find({
      ownerId: { $exists: false }
    }).toArray();
    
    console.log(`Found ${membersWithoutOwner.length} members without owner assignment`);
    
    if (membersWithoutOwner.length === 0) {
      console.log("All members already have owner assignments. Migration not needed.");
      return;
    }
    
    // CRITICAL DECISION: How to assign members to owners
    // Option 1: Assign all orphaned members to the first owner (simple but might be wrong)
    // Option 2: Create a prompt for manual assignment (better but requires input)
    
    console.log("\n--- IMPORTANT DECISION REQUIRED ---");
    console.log("How should we assign existing members to owners?");
    console.log("Option 1: Assign all members to the first owner");
    console.log("Option 2: You manually assign based on your knowledge");
    console.log("\nFor safety, we'll assign all to the FIRST OWNER.");
    console.log("You can manually reassign later if needed.\n");
    
    const firstOwner = owners[0];
    console.log(`Assigning all orphaned members to: ${firstOwner.firstName} ${firstOwner.lastName} (${firstOwner.email})`);
    
    // Update all members without ownerId
    const updateResult = await mongoose.connection.db.collection('members').updateMany(
      { ownerId: { $exists: false } },
      { $set: { ownerId: new mongoose.Types.ObjectId(firstOwner._id) } }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} members with owner assignment`);
    
    // Remove the unique constraint on phoneNo (since it should be unique per owner, not globally)
    try {
      await mongoose.connection.db.collection('members').dropIndex("phoneNo_1");
      console.log("Dropped global phoneNo unique index");
    } catch (error) {
      console.log("Global phoneNo index didn't exist or couldn't be dropped (this is okay)");
    }
    
    // Create compound index for owner + phoneNo uniqueness
    try {
      await mongoose.connection.db.collection('members').createIndex(
        { ownerId: 1, phoneNo: 1 }, 
        { unique: true }
      );
      console.log("Created compound index: ownerId + phoneNo (unique)");
    } catch (error) {
      console.log("Compound index might already exist:", error.message);
    }
    
    // Create performance indexes
    const indexes = [
      { ownerId: 1, nextDueDate: 1 },
      { ownerId: 1, paymentStatus: 1 },
      { ownerId: 1 }
    ];
    
    for (const index of indexes) {
      try {
        await mongoose.connection.db.collection('members').createIndex(index);
        console.log(`Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        console.log(`Index ${JSON.stringify(index)} might already exist`);
      }
    }
    
    // Verify the migration
    const ownersWithCounts = await Promise.all(
      owners.map(async (owner) => {
        const memberCount = await mongoose.connection.db.collection('members').countDocuments({
          ownerId: new mongoose.Types.ObjectId(owner._id)
        });
        return {
          owner: `${owner.firstName} ${owner.lastName}`,
          email: owner.email,
          memberCount: memberCount
        };
      })
    );
    
    console.log("\n--- MIGRATION SUMMARY ---");
    console.log("Members assigned per owner:");
    ownersWithCounts.forEach(item => {
      console.log(`- ${item.owner} (${item.email}): ${item.memberCount} members`);
    });
    
    const totalMembersAfter = await mongoose.connection.db.collection('members').countDocuments({});
    console.log(`\nTotal members in system: ${totalMembersAfter}`);
    
    const orphanedMembersAfter = await mongoose.connection.db.collection('members').countDocuments({
      ownerId: { $exists: false }
    });
    console.log(`Orphaned members remaining: ${orphanedMembersAfter}`);
    
    if (orphanedMembersAfter === 0) {
      console.log("\n✅ Migration completed successfully!");
      console.log("All members now have proper owner assignments.");
      console.log("\nNext steps:");
      console.log("1. Restart your server");
      console.log("2. Test member operations");
      console.log("3. If members were assigned to wrong owner, you can manually reassign them");
    } else {
      console.log(`\n⚠️ Warning: ${orphanedMembersAfter} members still without owners`);
    }
    
    await mongoose.connection.close();
    console.log("Migration completed and database connection closed.");
    
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

// Alternative: Manual assignment helper function
async function manualMemberAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    
    console.log("=== MANUAL MEMBER ASSIGNMENT HELPER ===");
    console.log("Use this if you need to reassign members to correct owners\n");
    
    const owners = await mongoose.connection.db.collection('owners').find({}).toArray();
    const members = await mongoose.connection.db.collection('members').find({}).toArray();
    
    console.log("Available Owners:");
    owners.forEach((owner, index) => {
      console.log(`${index + 1}. ${owner.firstName} ${owner.lastName} (${owner.email}) - ID: ${owner._id}`);
    });
    
    console.log(`\nFound ${members.length} members. You can reassign them using MongoDB commands:`);
    console.log("Example to move member to different owner:");
    console.log("db.members.updateOne({phoneNo: '9999999999'}, {$set: {ownerId: ObjectId('OWNER_ID_HERE')}})");
    
    await mongoose.connection.close();
  } catch (error) {
    console.error("Manual assignment helper error:", error);
  }
}

// FIXED: Call the correct function name
migrateMemberData();

// Export functions for flexibility
module.exports = {
  migrateMemberData,
  manualMemberAssignment
};