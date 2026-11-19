const mongoose = require('mongoose')

const adminNotificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['attendance-submitted'], required: true },
  teacherName: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true },
  attendanceDate: { type: String, required: true },
  studentCount: { type: Number, required: true, min: 0 },
  submittedAt: { type: Date, required: true },
  readAt: { type: Date, default: null }
}, {
  timestamps: true
})

adminNotificationSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AdminNotification', adminNotificationSchema)
