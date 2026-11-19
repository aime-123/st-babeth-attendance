const Attendance = require('../models/Attendance')
const Class = require('../models/Class')
const Student = require('../models/Student')
const User = require('../models/User')
const AdminNotification = require('../models/AdminNotification')
const { sendSuccess, sendError } = require('../utils/response')
const { publishAdminNotification } = require('../utils/adminNotifications')
const { dedupeAttendanceRecords } = require('../utils/attendanceHistory')

const canAccessClass = async (user, classId) => {
  if (!classId) {
    return false
  }

  if (user.role === 'admin') {
    return true
  }

  const schoolClass = await Class.findById(classId).select('_id assignedTeachers').lean()
  if (!schoolClass) {
    return false
  }

  return schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(user.id))
}

const buildDateRange = (dateValue) => {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date provided.')
  }

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

const getAttendance = async (req, res) => {
  try {
    const { classId, date, studentId, status } = req.query

    if (!classId) {
      return sendError(res, 'Class is required to fetch attendance.', 400)
    }

    if (!(await canAccessClass(req.user, classId))) {
      return sendError(res, 'You are not assigned to this class.', 403)
    }

    const query = { classId }

    if (date) {
      const { start, end } = buildDateRange(date)
      query.date = { $gte: start, $lt: end }
    }

    if (studentId) {
      query.studentId = studentId
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'firstName lastName registrationNumber')
      .populate('classId', 'className classCode')
      .sort({ date: -1, createdAt: -1 })
      .lean()

    return sendSuccess(res, {
      items: dedupeAttendanceRecords(records, status)
    }, 'Attendance records fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to fetch attendance.', 500)
  }
}

const buildStatusSummary = (records) => {
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length }

  for (const record of records) {
    if (record.status && summary[record.status] !== undefined) {
      summary[record.status] += 1
    }
  }

  return summary
}

const getAttendanceSummary = async (req, res) => {
  try {
    const { classId, date } = req.query

    if (!classId) {
      return sendError(res, 'Class is required to fetch attendance summary.', 400)
    }

    if (!(await canAccessClass(req.user, classId))) {
      return sendError(res, 'You are not assigned to this class.', 403)
    }

    const attendanceDate = date ? new Date(date) : new Date()
    const { start, end } = buildDateRange(attendanceDate)

    const summary = await Attendance.aggregate([
      {
        $match: {
          classId: new (require('mongoose')).Types.ObjectId(classId),
          date: { $gte: start, $lt: end }
        }
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: 1 }
        }
      }
    ])

    const result = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
    for (const item of summary) {
      if (item._id in result) {
        result[item._id] = item.total
      }
    }

    result.total = Object.values(result).reduce((sum, value) => sum + value, 0)

    return sendSuccess(res, result, 'Attendance summary fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to fetch attendance summary.', 500)
  }
}

const getCustomAttendanceReasons = async (req, res) => {
  try {
    const teacher = await User.findById(req.user.id)
      .select('status customAttendanceReasons')
      .lean()

    if (!teacher || teacher.status !== 'active') {
      return sendError(res, 'Your account is not active.', 403)
    }

    return sendSuccess(
      res,
      { items: teacher.customAttendanceReasons || [] },
      'Custom attendance reasons fetched successfully.'
    )
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to fetch custom attendance reasons.', 500)
  }
}

const saveCustomAttendanceReasons = async (req, res) => {
  try {
    const { reasons } = req.body || {}

    if (!Array.isArray(reasons) || reasons.some((reason) => typeof reason !== 'string')) {
      return sendError(res, 'Attendance reasons must be provided as a list of text values.', 400)
    }

    const normalizedReasons = reasons.map((reason) => reason.trim())
    if (normalizedReasons.some((reason) => reason.length < 2 || reason.length > 100)) {
      return sendError(res, 'Each custom attendance reason must be between 2 and 100 characters.', 400)
    }

    const teacher = await User.findById(req.user.id)
    if (!teacher || teacher.status !== 'active') {
      return sendError(res, 'Your account is not active.', 403)
    }

    const combinedReasons = [...(teacher.customAttendanceReasons || [])]
    const existingReasons = new Set(combinedReasons.map((reason) => reason.toLocaleLowerCase()))

    normalizedReasons.forEach((reason) => {
      const key = reason.toLocaleLowerCase()
      if (!existingReasons.has(key)) {
        combinedReasons.push(reason)
        existingReasons.add(key)
      }
    })

    if (combinedReasons.length > 100) {
      return sendError(res, 'You can save up to 100 custom attendance reasons.', 400)
    }

    teacher.customAttendanceReasons = combinedReasons
    await teacher.save()

    return sendSuccess(
      res,
      { items: combinedReasons },
      'Custom attendance reasons saved successfully.'
    )
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to save custom attendance reasons.', 500)
  }
}

const getAttendanceHistory = async (req, res) => {
  try {
    const { classId, dateFrom, dateTo, status, studentId } = req.query

    if (!classId) {
      return sendError(res, 'Class is required to fetch attendance history.', 400)
    }

    if (!(await canAccessClass(req.user, classId))) {
      return sendError(res, 'You are not assigned to this class.', 403)
    }

    const query = { classId }

    if (dateFrom || dateTo) {
      query.date = {}

      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        query.date.$gte = fromDate
      }

      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        query.date.$lte = toDate
      }
    }

    if (studentId) {
      query.studentId = studentId
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'firstName lastName registrationNumber')
      .populate('classId', 'className classCode')
      .populate('recordedBy', 'fullName email')
      .sort({ date: -1, createdAt: -1 })
      .lean()

    const uniqueRecords = dedupeAttendanceRecords(records, status)

    return sendSuccess(res, {
      items: uniqueRecords,
      summary: buildStatusSummary(uniqueRecords)
    }, 'Attendance history fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to fetch attendance history.', 500)
  }
}

const markAttendance = async (req, res) => {
  try {
    const { classId, date, entries = [] } = req.body

    if (!classId || !date) {
      return sendError(res, 'Class and attendance date are required.', 400)
    }

    let teacherName = ''
    let notifiedClass = null

    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user.id).select('status permissions fullName').lean()
      if (!teacher || teacher.status !== 'active') {
        return sendError(res, 'Your account is not active.', 403)
      }
      if (teacher.permissions?.canMarkAttendance === false) {
        return sendError(res, 'You do not have permission to mark attendance.', 403)
      }
      teacherName = teacher.fullName || 'A teacher'
    }

    if (!(await canAccessClass(req.user, classId))) {
      return sendError(res, 'You are not assigned to this class.', 403)
    }

    if (req.user.role === 'teacher') {
      notifiedClass = await Class.findById(classId).select('className classCode').lean()
      if (!notifiedClass) {
        return sendError(res, 'Selected class does not exist.', 404)
      }
    }

    const attendanceDate = new Date(date)
    if (Number.isNaN(attendanceDate.getTime())) {
      return sendError(res, 'Attendance date is invalid.', 400)
    }

    const validStatuses = ['present', 'absent', 'late', 'excused']
    const allStudentIds = await Student.find({ classId }).select('_id').lean()
    const validStudentIds = new Set(allStudentIds.map((student) => String(student._id)))

    if (!Array.isArray(entries) || entries.length === 0) {
      return sendError(res, 'At least one attendance entry is required.', 400)
    }

    const operations = []
    const seenStudentIds = new Set()

    for (const entry of entries) {
      if (!entry || !entry.studentId || !validStatuses.includes(entry.status)) {
        return sendError(res, 'Each attendance entry requires a valid student and status.', 400)
      }

      const studentId = String(entry.studentId)
      if (seenStudentIds.has(studentId)) {
        return sendError(res, 'Each student can have only one attendance entry per class and date.', 400)
      }
      seenStudentIds.add(studentId)

      if (!validStudentIds.has(studentId)) {
        return sendError(res, `Student ${entry.studentId} is not part of this class.`, 400)
      }

      operations.push({
        updateOne: {
          filter: {
            studentId: entry.studentId,
            classId,
            date: attendanceDate
          },
          update: {
            $set: {
              studentId: entry.studentId,
              classId,
              date: attendanceDate,
              status: entry.status,
              remarks: String(entry.remarks || '').trim(),
              recordedBy: req.user.id,
              updatedBy: req.user.id
            }
          },
          upsert: true
        }
      })
    }

    const result = await Attendance.bulkWrite(operations, { ordered: false })
    const savedRecords = await Attendance.find({
      classId,
      date: attendanceDate
    })
      .populate('studentId', 'firstName lastName registrationNumber')
      .sort({ createdAt: -1 })
      .lean()
    const uniqueSavedRecords = dedupeAttendanceRecords(savedRecords)

    if (req.user.role === 'teacher') {
      const notification = {
        type: 'attendance-submitted',
        teacherName,
        className: [notifiedClass.classCode, notifiedClass.className].filter(Boolean).join(' · ') || 'a class',
        attendanceDate: String(date).slice(0, 10),
        studentCount: entries.length,
        submittedAt: new Date().toISOString()
      }

      try {
        const savedNotification = await AdminNotification.create(notification)
        publishAdminNotification({
          ...notification,
          _id: String(savedNotification._id),
          createdAt: savedNotification.createdAt,
          readAt: savedNotification.readAt
        })
      } catch (notificationError) {
        console.error('Unable to persist a teacher attendance notification.', notificationError)
        publishAdminNotification(notification)
      }
    }

    return sendSuccess(res, {
      items: uniqueSavedRecords,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0
    }, 'Attendance saved successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to save attendance.', 500)
  }
}

module.exports = {
  getAttendance,
  getAttendanceSummary,
  getCustomAttendanceReasons,
  saveCustomAttendanceReasons,
  getAttendanceHistory,
  markAttendance
}
