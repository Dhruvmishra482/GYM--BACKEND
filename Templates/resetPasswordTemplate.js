const resetPasswordTemplate = (resetLink, ownerName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Your Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
        .reset-btn { display: inline-block; padding: 12px 30px; background-color: #3498db; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .reset-btn:hover { background-color: #2980b9; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; text-align: center; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏋️ Gym Management System</div>
          <h2>Password Reset Request</h2>
        </div>
        <p>Hello ${ownerName},</p>
        <p>We received a request to reset your password for your Gym Management account. If you made this request, please click the button below to reset your password:</p>
        <div style="text-align: center;">
          <a href="${resetLink}" class="reset-btn">Reset Password</a>
        </div>
        <div class="warning">
          <strong>⚠️ Important:</strong> This link will expire in 15 minutes for security reasons.
        </div>
        <p>If you cannot click the button above, copy and paste the following link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 14px;">
          ${resetLink}
        </p>
        <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; 2025 Gym Management System. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Export karne ka standard tareeka
module.exports = resetPasswordTemplate;
