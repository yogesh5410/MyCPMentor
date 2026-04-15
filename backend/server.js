require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const { connect: connectRabbitMQ } = require('./config/rabbitmq')
const authRoutes = require('./routes/auth.routes')
const problemRoutes = require('./routes/problem.routes')
const adminRoutes = require('./routes/admin.routes')
const internalRoutes = require('./routes/internal.routes')

const app = express()

// Connect MongoDB
connectDB()

// Connect RabbitMQ (non-blocking — retries in background)
connectRabbitMQ()

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow the frontend origin and pass cookies through
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true, // required for cookies to be sent cross-origin
  })
)

app.use(express.json())
app.use(cookieParser()) // parse Cookie header into req.cookies

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/problems', problemRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/internal', internalRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ─── Global error handler (Express 5 auto-passes async errors here) ──────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
