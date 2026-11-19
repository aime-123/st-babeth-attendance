const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
  remarks: { type: String, default: '', trim: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
  timestamps: true
})

attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true })
attendanceSchema.index({ classId: 1, date: 1 })
attendanceSchema.index({ recordedBy: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)
