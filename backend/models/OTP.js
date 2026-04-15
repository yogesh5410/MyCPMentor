const mongoose = require('mongoose')

// MongoDB TTL index: documents are automatically deleted 300 seconds (5 min)
// after their createdAt field value. This is handled entirely by MongoDB —
// no cron job or cleanup needed.

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  // Store bcrypt hash, never the plain OTP
  otpHash: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // TTL: 5 minutes
  },
})

module.exports = mongoose.model('OTP', otpSchema)
