const cron = require("node-cron");
const Member = require("../Basic/Features/MemberCrud/Models/Member");
const Owner = require("../Basic/Features/MemberCrud/Models/Owner")
const sendWhatsapp = require("../Utils/sendWhatsapp");
const { resetCustomBillingCycles, sendExpiryReminders } = require("../Basic/Features/Subscription/Controllers/subscriptionController");
const REMINDER_TEMPLATE_SID ="HXbbe0bd174d2ee0cf1b75a2f7097d15bd";

// // EXISTING: Daily due member reminder (unchanged)
// cron.schedule("0 0 * * *", async () => {
//     console.log("Running daily due member reminders...");
//     const today = new Date().toISOString().split("T")[0];
//     const dueMember = await Member.find({ nextDueDate: today });

//     for (const member of dueMember) {
//         try {
//             await sendWhatsapp(
//                 member.phoneNo,
//                 `Hi ${member.name}, your gym fees is due today.`
//             );
//             await sendWhatsapp(
//                 process.env.OWNER_PHONE,
//                 `Fees due today for member ${member.name} (${member.feesAmount})`
//             );
//         } catch (error) {
//             console.error(`Failed to send WhatsApp to ${member.name}:`, error);
//         }
//     }
// });

cron.schedule("0 0 * * *", async () => {
  console.log("Running daily due member reminders...");

  const today = new Date().toISOString().split("T")[0];
  const dueMember = await Member.find({ nextDueDate: today });

  for (const member of dueMember) {
    try {
      // 🔔 Send reminder to member
      await sendWhatsapp(
        member.phoneNo,
        REMINDER_TEMPLATE_SID,          
        {
          "1": member.name,            
          "2": `₹${member.feesAmount}`  
        }
      );
      await sendWhatsapp(
        process.env.OWNER_PHONE,
        REMINDER_TEMPLATE_SID,
        {
          "1": member.name,
          "2": `₹${member.feesAmount}`
        }
      );

    } catch (error) {
      console.error(`Failed to send WhatsApp to ${member.name}:`, error);
    }
  }
});

// NEW: Daily billing cycle reset check (2 AM)
cron.schedule("0 2 * * *", async () => {
    console.log("Running daily billing cycle reset check...");
    try {
        // Call the controller function directly
        await resetCustomBillingCycles();
        console.log("Billing cycle reset check completed");
    } catch (error) {
        console.error("Billing cycle reset failed:", error);
    }
});

// NEW: Daily subscription expiry reminder check (9 AM)
cron.schedule("0 9 * * *", async () => {
    console.log("Running subscription expiry reminder check...");
    try {
        // Call the controller function directly
        await sendExpiryReminders();
        console.log("Expiry reminder check completed");
    } catch (error) {
        console.error("Expiry reminders failed:", error);
    }
});

// NEW: Weekly member count sync (every Sunday at 3 AM)
cron.schedule("0 3 * * 0", async () => {
    console.log("Running weekly member count sync...");
    try {
        const owners = await Owner.find({ 
            subscriptionPlan: { $ne: "NONE" } 
        });
        
        let syncedUsers = 0;
        
        for (let owner of owners) {
            const actualCount = await Member.countDocuments({ 
                ownerId: owner._id 
            });
            
            if (owner.usageStats.membersCount !== actualCount) {
                console.log(`Syncing ${owner.email}: ${owner.usageStats.membersCount} → ${actualCount}`);
                owner.usageStats.membersCount = actualCount;
                owner.usageStats.lastMemberCountUpdate = new Date();
                await owner.save();
                syncedUsers++;
            }
        }
        
        console.log(`Member count sync completed: ${syncedUsers} users updated out of ${owners.length} total`);
        
    } catch (error) {
        console.error("Member count sync failed:", error);
    }
});

// NEW: Health check log (every hour)
cron.schedule("0 * * * *", () => {
    console.log(`Scheduler health check: ${new Date().toISOString()} - All jobs running`);
});

console.log("Scheduler initialized:");
console.log("- Daily due member reminders: 12:00 AM");
console.log("- Daily billing cycle reset: 2:00 AM");
console.log("- Weekly member count sync: Sunday 3:00 AM");
console.log("- Daily expiry reminders: 9:00 AM");
console.log("- Hourly health check");

module.exports = {};