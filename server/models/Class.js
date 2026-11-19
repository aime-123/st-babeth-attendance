const mongoose = require('mongoose')

const scheduleEntrySchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true },
  startTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/, required: true },
  endTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/, required: true },
  room: { type: String, trim: true, maxlength: 60, default: '' }
}, { _id: false })

const classSchema = new mongoose.Schema({
  className: { type: String, required: true, trim: true },
  classCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  trade: { type: String, required: true, trim: true },
  level: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  assignedTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  schedule: { type: [scheduleEntrySchema], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  description: { type: String, default: '' }
}, {
  timestamps: true
})

classSchema.path('schedule').validate((sessions) => sessions.every((session) => session.endTime > session.startTime), 'Each class session must end after it starts.')

module.exports = mongoose.model('Class', classSchema)
