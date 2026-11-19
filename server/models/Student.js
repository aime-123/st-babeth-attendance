const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  guardianName: { type: String, default: '', trim: true, maxlength: 120 },
  guardianPhone: { type: String, default: '', trim: true, maxlength: 30 },
  gender: { type: String, enum: ['male', 'female'], required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true, trim: true },
  enrollmentDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, {
  timestamps: true
})

studentSchema.index({ classId: 1, registrationNumber: 1 }, { unique: true })

module.exports = mongoose.model('Student', studentSchema)
