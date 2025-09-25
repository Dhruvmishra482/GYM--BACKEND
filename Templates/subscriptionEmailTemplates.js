// templates/subscriptionEmailTemplates.js

const createExpiryEmailTemplate = (userName, daysLeft, planName) => {
    const urgencyLevel = daysLeft <= 1 ? "urgent" : daysLeft <= 3 ? "warning" : "reminder";
    const subject = daysLeft <= 1 
        ? `⚠️ URGENT: Your ${planName} expires today!`
        : `🔔 Reminder: Your ${planName} expires in ${daysLeft} days`;
    
    return {
        subject,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${urgencyLevel === 'urgent' ? '#dc2626' : urgencyLevel === 'warning' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 20px; text-align: center;">
                <h1>${urgencyLevel === 'urgent' ? '⚠️' : '🔔'} Subscription ${urgencyLevel === 'urgent' ? 'Expiring Today' : 'Reminder'}</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hi ${userName},</h2>
                <p style="font-size: 16px; line-height: 1.6;">
                    ${daysLeft <= 1 
                        ? 'Your Iron Throne Gym subscription expires <strong>today</strong>!'
                        : `Your Iron Throne Gym subscription will expire in <strong>${daysLeft} days</strong>.`
                    }
                </p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>Current Plan: ${planName}</h3>
                    <p>Don't lose access to your gym management features:</p>
                    <ul>
                        <li>Member management dashboard</li>
                        <li>WhatsApp payment reminders</li>
                        <li>Analytics and reports</li>
                        <li>AI-powered insights</li>
                    </ul>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/payment?plan=BASIC&billing=monthly" 
                       style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Renew Subscription
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                    Need help? Reply to this email or contact our support team.
                </p>
            </div>
        </div>`
    };
};

const createPostExpiryEmailTemplate = (userName, planName) => {
    return {
        subject: "🔄 Reactivate Your Iron Throne Gym Subscription",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                <h1>🔄 Subscription Expired</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hi ${userName},</h2>
                <p style="font-size: 16px; line-height: 1.6;">
                    Your Iron Throne Gym subscription has expired. Your account has been downgraded to free access.
                </p>
                <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <h3>What this means:</h3>
                    <ul>
                        <li>❌ Limited member management access</li>
                        <li>❌ No WhatsApp reminders</li>
                        <li>❌ No analytics and reports</li>
                        <li>❌ No AI insights</li>
                    </ul>
                </div>
                <p><strong>Good news:</strong> All your data is safely stored. Reactivate anytime to regain full access!</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/payment?plan=BASIC&billing=monthly" 
                       style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Reactivate Now
                    </a>
                </div>
            </div>
        </div>`
    };
};

const createUpgradeSuccessTemplate = (userName, oldPlan, newPlan, savings) => {
    return {
        subject: `🎉 Successfully upgraded to ${newPlan}!`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
                <h1>🎉 Upgrade Successful!</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Hi ${userName},</h2>
                <p style="font-size: 16px; line-height: 1.6;">
                    Congratulations! You've successfully upgraded from <strong>${oldPlan}</strong> to <strong>${newPlan}</strong>.
                </p>
                ${savings > 0 ? `
                <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <h3>💰 You saved ₹${savings} with prorated billing!</h3>
                    <p>We credited your remaining subscription time toward your new plan.</p>
                </div>
                ` : ''}
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>Your new features are now active:</h3>
                    <ul>
                        <li>✅ Increased member limits</li>
                        <li>✅ Enhanced analytics</li>
                        <li>✅ Priority support</li>
                        <li>✅ Advanced features</li>
                    </ul>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/dashboard" 
                       style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Explore Your New Features
                    </a>
                </div>
            </div>
        </div>`
    };
};

module.exports = {
    createExpiryEmailTemplate,
    createPostExpiryEmailTemplate,
    createUpgradeSuccessTemplate
};