const passwordResetSuccessTemplate = (ownerName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Reset Successful</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .success-icon {
                font-size: 48px;
                color: #27ae60;
                margin-bottom: 20px;
            }
            .login-btn {
                display: inline-block;
                padding: 12px 30px;
                background-color: #27ae60;
                color: white !important;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
            }
            .login-btn:hover {
                background-color: #219a52;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 14px;
                color: #666;
                text-align: center;
            }
            .security-notice {
                background-color: #e8f5e8;
                border: 1px solid #c3e6c3;
                color: #2d5a2d;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏋️ Gym Management System</div>
                <div class="success-icon">✅</div>
                <h2>Password Reset Successful!</h2>
            </div>
            
            <p>Hello ${ownerName},</p>
            
            <p>Great news! Your password has been successfully reset. You can now log in to your Gym Management account with your new password.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONT_END_URL}/login" class="login-btn">Login to Your Account</a>
            </div>
            
            <div class="security-notice">
                <strong>🔒 Security Reminder:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Keep your password secure and don't share it with anyone</li>
                    <li>Log out from shared devices after use</li>
                    <li>Contact support if you notice any suspicious activity</li>
                </ul>
            </div>
            
            <p>If you did not reset your password, please contact our support team immediately.</p>
            
            <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>Need help? Contact us at: <a href="mailto:support@gymmanagement.com">support@gymmanagement.com</a></p>
                <p>&copy; 2025 Gym Management System. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};
module.exports=passwordResetSuccessTemplate