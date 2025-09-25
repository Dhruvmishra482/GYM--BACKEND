// Payment Success Email Template
exports.paymentSuccessTemplate = (userName, planName, amount, orderId, expiryDate) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - Iron Throne Gym</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 48px; color: #28a745; text-align: center; margin-bottom: 20px; }
            .plan-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏋️ Iron Throne Gym</h1>
                <h2>Payment Successful!</h2>
            </div>
            <div class="content">
                <div class="success-icon">✅</div>
                
                <p>Dear ${userName},</p>
                
                <p>Congratulations! Your payment has been processed successfully. Welcome to the <strong>${planName}</strong> plan!</p>
                
                <div class="plan-details">
                    <h3>📋 Subscription Details</h3>
                    <p><strong>Plan:</strong> ${planName}</p>
                    <p><strong>Amount Paid:</strong> ₹${amount}</p>
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Valid Until:</strong> ${new Date(expiryDate).toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</p>
                </div>
                
                <p>🎉 You now have access to all premium features! Start exploring your enhanced gym management experience.</p>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
                        Access Dashboard
                    </a>
                </div>
                
                <p>If you have any questions or need assistance, feel free to contact our support team.</p>
                
                <p>Thank you for choosing Iron Throne Gym!</p>
                
                <p>Best regards,<br>
                The Iron Throne Gym Team</p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this email.</p>
                <p>© 2025 Iron Throne Gym. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Payment Failure Email Template
exports.paymentFailureTemplate = (userName, planName, amount, orderId, reason = "Payment processing failed") => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed - Iron Throne Gym</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .failure-icon { font-size: 48px; color: #dc3545; text-align: center; margin-bottom: 20px; }
            .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .retry-button { background: #28a745; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏋️ Iron Throne Gym</h1>
                <h2>Payment Failed</h2>
            </div>
            <div class="content">
                <div class="failure-icon">❌</div>
                
                <p>Dear ${userName},</p>
                
                <p>We're sorry to inform you that your payment for the <strong>${planName}</strong> plan could not be processed.</p>
                
                <div class="payment-details">
                    <h3>📋 Payment Details</h3>
                    <p><strong>Plan:</strong> ${planName}</p>
                    <p><strong>Amount:</strong> ₹${amount}</p>
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</p>
                </div>
                
                <p><strong>What you can do:</strong></p>
                <ul>
                    <li>Check if you have sufficient balance in your payment method</li>
                    <li>Try using a different payment method</li>
                    <li>Contact your bank if the issue persists</li>
                    <li>Retry the payment process</li>
                </ul>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing" class="button retry-button">
                        Try Again
                    </a>
                </div>
                
                <p>If you continue to face issues, please contact our support team for assistance.</p>
                
                <p>Thank you for your understanding.</p>
                
                <p>Best regards,<br>
                The Iron Throne Gym Team</p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this email.</p>
                <p>© 2025 Iron Throne Gym. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Welcome to Premium Email Template
exports.welcomePremiumTemplate = (userName, planName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${planName} - Iron Throne Gym</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .welcome-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
            .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature-item { margin: 15px 0; padding-left: 30px; position: relative; }
            .feature-item:before { content: "✅"; position: absolute; left: 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏋️ Iron Throne Gym</h1>
                <h2>Welcome to ${planName}!</h2>
            </div>
            <div class="content">
                <div class="welcome-icon">🎉</div>
                
                <p>Dear ${userName},</p>
                
                <p>Welcome to the <strong>${planName}</strong> experience! You're now part of our premium community.</p>
                
                <div class="features">
                    <h3>🚀 What's New for You:</h3>
                    <div class="feature-item">Advanced member management dashboard</div>
                    <div class="feature-item">Detailed analytics and reports</div>
                    <div class="feature-item">Member progress tracking</div>
                    <div class="feature-item">Automated billing and payments</div>
                    <div class="feature-item">Priority customer support</div>
                    <div class="feature-item">Mobile app access</div>
                </div>
                
                <p>🎯 <strong>Getting Started:</strong></p>
                <ol>
                    <li>Log into your dashboard</li>
                    <li>Explore the new premium features</li>
                    <li>Set up your gym preferences</li>
                    <li>Start managing your members efficiently</li>
                </ol>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
                        Explore Dashboard
                    </a>
                </div>
                
                <p>If you need any help getting started, our support team is here to assist you.</p>
                
                <p>Thank you for upgrading to ${planName}!</p>
                
                <p>Best regards,<br>
                The Iron Throne Gym Team</p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this email.</p>
                <p>© 2025 Iron Throne Gym. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};