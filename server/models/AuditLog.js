const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true },
  module: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true }
}, {
  timestamps: true
})

auditLogSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)
