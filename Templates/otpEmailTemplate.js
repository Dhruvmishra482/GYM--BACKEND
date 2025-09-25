// templates/otpEmailTemplate.js
exports.otpEmailTemplate = (otp, firstName) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Gym Management</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .container {
                background: #f9f9f9;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
            }
            .header {
                background: #007bff;
                color: white;
                padding: 20px;
                border-radius: 10px 10px 0 0;
                margin: -30px -30px 20px -30px;
            }
            .otp-code {
                background: #007bff;
                color: white;
                font-size: 32px;
                font-weight: bold;
                padding: 15px 25px;
                border-radius: 8px;
                letter-spacing: 8px;
                margin: 20px 0;
                display: inline-block;
            }
            .warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏋️ Gym Management System</h1>
                <p>Email Verification Required</p>
            </div>
            
            <h2>Hello ${firstName}!</h2>
            <p>Welcome to our Gym Management System! To complete your registration, please verify your email address using the OTP code below:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>Enter this code on the verification page to activate your account.</p>
            
            <div class="warning">
                <strong>⏰ Important:</strong> This OTP will expire in 10 minutes for security reasons.
            </div>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <div class="footer">
                <p>Thank you for choosing our Gym Management System!</p>
                <p><em>This is an automated email, please do not reply.</em></p>
            </div>
        </div>
    </body>
    </html>
  `;
};