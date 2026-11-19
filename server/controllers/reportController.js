const mongoose = require('mongoose')
﻿const Attendance = require('../models/Attendance')
const Class = require('../models/Class')
const Student = require('../models/Student')
const { sendSuccess, sendError } = require('../utils/response')

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

const getAccessibleClassIds = async (user) => {
  if (user.role === 'admin') {
    return null
  }

  const classes = await Class.find({ assignedTeachers: user.id }).select('_id').lean()
  return classes.map((schoolClass) => schoolClass._id)
}

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

const buildSummary = (records) => {
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length }

  records.forEach((record) => {
    if (record.status && summary[record.status] !== undefined) {
      summary[record.status] += 1
    }
  })

  return summary
}

const getReports = async (req, res) => {
  try {
    const { classId, dateFrom, dateTo } = req.query
    const fromDate = dateFrom ? parseDateOnly(dateFrom) : null
    const toDate = dateTo ? parseDateOnly(dateTo) : null

    if (classId && !mongoose.isValidObjectId(classId)) {
      return sendError(res, 'Selected class is invalid.', 400)
    }

    if ((dateFrom && !fromDate) || (dateTo && !toDate)) {
      return sendError(res, 'Report dates must be valid calendar dates.', 400)
    }

    if (fromDate && toDate && fromDate > toDate) {
      return sendError(res, 'The start date must be on or before the end date.', 400)
    }

    const classQuery = {}
    if (classId) {
      if (!(await canAccessClass(req.user, classId))) {
        return sendError(res, 'You are not assigned to this class.', 403)
      }

      classQuery._id = classId
    } else if (req.user.role === 'teacher') {
      const accessibleClassIds = await getAccessibleClassIds(req.user)
      classQuery._id = { $in: accessibleClassIds }
    }

    const classes = await Class.find(classQuery).select('_id className classCode trade level academicYear assignedTeachers').sort({ className: 1 }).lean()
    const classIds = classes.map((schoolClass) => String(schoolClass._id))

    if (classIds.length === 0) {
      return sendSuccess(res, {
        summary: { totalStudents: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0 },
        classes: [],
        records: []
      }, 'No classes found for this report.')
    }

    const studentQuery = classId ? { classId } : { classId: { $in: classIds } }
    const students = await Student.find(studentQuery).select('_id classId firstName lastName registrationNumber status').lean()

    const attendanceQuery = classId ? { classId } : { classId: { $in: classIds } }
    if (fromDate || toDate) {
      attendanceQuery.date = {}
      if (fromDate) {
        attendanceQuery.date.$gte = fromDate
      }
      if (toDate) {
        const endDate = new Date(toDate)
        endDate.setUTCDate(endDate.getUTCDate() + 1)
        attendanceQuery.date.$lt = endDate
      }
    }

    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'firstName lastName registrationNumber')
      .populate('classId', 'className classCode')
      .sort({ date: -1, createdAt: -1 })
      .lean()

    const summary = buildSummary(records)
    const totalStudents = students.length
    const presentCount = summary.present || 0
    const attendanceRate = summary.total > 0 ? (presentCount / summary.total) * 100 : 0

    summary.attendanceRate = Number(attendanceRate.toFixed(2))
    summary.totalStudents = totalStudents

    const classBreakdown = classes.map((schoolClass) => {
      const classStudentIds = students
        .filter((student) => String(student.classId) === String(schoolClass._id))
        .map((student) => String(student._id))

      const classRecords = records.filter((record) => String(record.classId?._id || record.classId) === String(schoolClass._id))
      const classSummary = buildSummary(classRecords)

      return {
        _id: schoolClass._id,
        className: schoolClass.className,
        classCode: schoolClass.classCode,
        trade: schoolClass.trade,
        level: schoolClass.level,
        academicYear: schoolClass.academicYear,
        totalStudents: classStudentIds.length,
        present: classSummary.present,
        absent: classSummary.absent,
        late: classSummary.late,
        excused: classSummary.excused,
        attendanceRate: classSummary.total > 0 ? Number(((classSummary.present / classSummary.total) * 100).toFixed(2)) : 0,
        records: classRecords.length
      }
    })

    return sendSuccess(res, {
      summary,
      classes: classBreakdown,
      records
    }, 'Reports generated successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, error.message || 'Unable to generate report.', 500)
  }
}

module.exports = { getReports }
