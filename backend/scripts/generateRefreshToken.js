// One-time script to generate GOOGLE_REFRESH_TOKEN for Nodemailer Gmail OAuth2.
//
// BEFORE running this:
//   1. Go to Google Cloud Console → APIs & Services → Credentials
//   2. Click your OAuth 2.0 Client ID
//   3. Under "Authorized redirect URIs", add:  http://localhost:3001/oauth2callback
//   4. Save
//
// Then run:  node scripts/generateRefreshToken.js
//
// A browser URL will be printed. Open it, grant Gmail access for the account
// you want to send OTP emails FROM. The refresh token will print in this terminal.
// Copy it to GOOGLE_REFRESH_TOKEN in your .env file.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { google } = require('googleapis')
const http = require('http')
const url = require('url')

const REDIRECT_URI = 'http://localhost:3001/oauth2callback'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://mail.google.com/'],
  prompt: 'consent', // force consent screen so Google always returns a refresh_token
})

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░')
console.log('  MyCPMentor — Gmail OAuth2 Refresh Token Generator')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░\n')
console.log('[1] Make sure you added this redirect URI in Google Cloud Console:')
console.log(`    ${REDIRECT_URI}\n`)
console.log('[2] Open this URL in your browser (sign in as the Gmail sender account):\n')
console.log('   ', authUrl)
console.log('\n⏳ Waiting for authorization...\n')

const server = http.createServer(async (req, res) => {
  const { query } = url.parse(req.url, true)

  if (!query.code) {
    res.writeHead(400)
    res.end('<h2>❌ Authorization failed. Check the terminal.</h2>')
    server.close()
    process.exit(1)
  }

  try {
    const { tokens } = await oauth2Client.getToken(query.code)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <h2 style="font-family:sans-serif;color:green;">
        ✅ Success! Check your terminal for the refresh token.
      </h2>
    `)
    server.close()

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░')
    console.log('✅  Add these two lines to your backend/.env file:\n')
    console.log(`GMAIL_USER=<the-gmail-you-just-authorized>`)
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░\n')
    process.exit(0)
  } catch (err) {
    console.error('❌ Failed to exchange code for tokens:', err.message)
    res.writeHead(500)
    res.end('<h2>❌ Token exchange failed. Check terminal.</h2>')
    server.close()
    process.exit(1)
  }
})

server.listen(3001, () => {
  // Server ready, waiting for OAuth redirect
})
