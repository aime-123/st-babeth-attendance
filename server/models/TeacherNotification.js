const mongoose = require('mongoose')

const teacherNotificationSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  readAt: { type: Date, default: null }
}, {
  timestamps: true
})

teacherNotificationSchema.index({ teacherId: 1, createdAt: -1 })

module.exports = mongoose.model('TeacherNotification', teacherNotificationSchema)
