const mongoose = require('mongoose')

const schoolSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'school' },
  schoolName: { type: String, required: true, trim: true, default: 'St Babeth TSS' },
  district: { type: String, trim: true, default: '' },
  contactEmail: { type: String, trim: true, lowercase: true, default: '' },
  aboutText: { type: String, trim: true, default: '' },
  logoDataUrl: { type: String, default: '' },
  academicYear: { type: String, trim: true, default: '' },
  academicYearStartDate: { type: String, default: '' },
  academicYearEndDate: { type: String, default: '' },
  currentTermName: { type: String, trim: true, default: '' },
  currentTermStartDate: { type: String, default: '' },
  currentTermEndDate: { type: String, default: '' }
}, {
  timestamps: true
})

module.exports = mongoose.model('SchoolSettings', schoolSettingsSchema)
