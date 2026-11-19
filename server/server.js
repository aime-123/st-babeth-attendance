const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const dotenv = require('dotenv')

dotenv.config({ quiet: true })

const { connectDB } = require('./config/db')
const { env } = require('./config/env')
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const classRoutes = require('./routes/classRoutes')
const studentRoutes = require('./routes/studentRoutes')
const attendanceRoutes = require('./routes/attendanceRoutes')
const reportRoutes = require('./routes/reportRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const notificationRoutes = require('./routes/notificationRoutes')

const app = express()

const allowedOrigins = new Set(env.CLIENT_URLS)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1):(?:3|4|5)\d{2,3}$/.test(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json({ limit: '3mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev', {
  skip: (_req, res) => res.statusCode < 400
}))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'St Babeth TSS API is running.',
    timestamp: new Date().toISOString()
  })
})

app.get('/', (_req, res) => {
  res.json({
    app: 'St Babeth TSS Attendance Management System',
    phase: 'Phase 1 - Project setup complete'
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  })
})

const startServer = async () => {
  await connectDB()

  app.listen(env.PORT, () => {
    console.log(`API port: ${env.PORT}`)
  })
}

startServer()

module.exports = app
