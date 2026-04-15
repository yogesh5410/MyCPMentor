// Nodemailer Gmail SMTP using OAuth2
// This avoids storing passwords and is more secure than app passwords.
//
// How it works:
//   1. We use the googleapis OAuth2 client to get a fresh access token
//      from our stored refresh token (refresh tokens don't expire unless revoked).
//   2. We pass that access token to Nodemailer's OAuth2 auth transport.
//   3. Gmail accepts it — email is sent.
//
// To get GOOGLE_REFRESH_TOKEN, run: node scripts/generateRefreshToken.js

const nodemailer = require('nodemailer')
const { google } = require('googleapis')

// OAuth2 client uses the playground redirect URI — this matches what the
// generateRefreshToken script uses when we obtained the refresh token.
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/oauth2callback'
)

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

const getTransporter = async () => {
  // getAccessToken() uses the refresh token to obtain a short-lived access token.
  // It caches and auto-refreshes, so this is safe to call on every email.
  const { token } = await oauth2Client.getAccessToken()

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: token,
    },
  })
}

const sendOTPEmail = async (to, otp) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GMAIL_USER) {
    throw new Error('GMAIL_USER and GOOGLE_REFRESH_TOKEN must be set in .env to send emails.')
  }

  const transporter = await getTransporter()

  await transporter.sendMail({
    from: `"MyCPMentor" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${otp} is your MyCPMentor code`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:22px;font-weight:900;background:linear-gradient(90deg,#7c3aed,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">MyCPMentor</span>
        </div>
        <p style="color:#374151;font-size:16px;margin:0 0 8px;">Your one-time login code:</p>
        <div style="font-size:48px;font-weight:800;letter-spacing:14px;color:#111827;margin:24px 0;font-variant-numeric:tabular-nums;">${otp}</div>
        <p style="color:#6b7280;font-size:14px;margin:0 0 6px;">⏱ Expires in <strong>5 minutes</strong></p>
        <p style="color:#6b7280;font-size:14px;margin:0;">🔒 Never share this code with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}

module.exports = { sendOTPEmail }
