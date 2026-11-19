const Class = require('../models/Class')
const User = require('../models/User')
const { sendSuccess, sendError } = require('../utils/response')

const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const isValidSchedule = (schedule) => Array.isArray(schedule) && schedule.every((session) => (
  session &&
  scheduleDays.includes(session.day) &&
  timePattern.test(session.startTime) &&
  timePattern.test(session.endTime) &&
  session.endTime > session.startTime &&
  (session.room === undefined || (typeof session.room === 'string' && session.room.length <= 60))
))

const getAssignedTeachersPopulation = (req) => ({
  path: 'assignedTeachers',
  select: 'fullName email role',
  ...(req.user.role === 'teacher' ? { match: { _id: req.user.id } } : {})
})

const parseFilters = (req) => {
  const { q, status, teacherId } = req.query
  const query = {
    ...(req.user.role === 'teacher' ? { assignedTeachers: req.user.id } : {})
  }

  if (q) {
    query.$or = [
      { className: new RegExp(q, 'i') },
      { classCode: new RegExp(q, 'i') },
      { trade: new RegExp(q, 'i') },
      { level: new RegExp(q, 'i') }
    ]
  }

  if (status) {
    query.status = status
  }

  if (teacherId && req.user.role === 'admin') {
    query.assignedTeachers = teacherId
  }

  return query
}

const normalizeTeacherIds = async (assignedTeachers = []) => {
  if (!Array.isArray(assignedTeachers)) {
    return []
  }

  const uniqueIds = [...new Set(assignedTeachers.map((teacher) => String(teacher)))]

  if (uniqueIds.length === 0) {
    return []
  }

  const teachers = await User.find({
    _id: { $in: uniqueIds },
    role: 'teacher'
  }).select('_id')

  return teachers.map((teacher) => teacher._id)
}

const getClasses = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const query = parseFilters(req)

    const skip = (Number(page) - 1) * Number(limit)
    const classes = await Class.find(query)
      .populate(getAssignedTeachersPopulation(req))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    const total = await Class.countDocuments(query)

    return sendSuccess(res, {
      items: classes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    }, 'Classes fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch classes.', 500)
  }
}

const getClassById = async (req, res) => {
  try {
    const classRecord = await Class.findById(req.params.id)
      .populate(getAssignedTeachersPopulation(req))
      .lean()

    if (!classRecord) {
      return sendError(res, 'Class not found.', 404)
    }

    if (req.user.role === 'teacher' && !classRecord.assignedTeachers.some((teacher) => String(teacher._id) === String(req.user.id))) {
      return sendError(res, 'You are not assigned to this class.', 403)
    }

    return sendSuccess(res, classRecord, 'Class fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch class.', 500)
  }
}

const createClass = async (req, res) => {
  try {
    const {
      className,
      classCode,
      trade,
      level,
      academicYear,
      assignedTeachers = [],
      schedule = [],
      status = 'active',
      description = ''
    } = req.body

    if (!className || !classCode || !trade || !level || !academicYear) {
      return sendError(res, 'Class name, code, trade, level, and academic year are required.', 400)
    }

    if (!isValidSchedule(schedule)) {
      return sendError(res, 'Each schedule session needs a valid day, start time, end time, and room of at most 60 characters.', 400)
    }

    const normalizedClassCode = String(classCode).trim().toUpperCase()
    const existingClass = await Class.findOne({ classCode: normalizedClassCode })

    if (existingClass) {
      return sendError(res, 'A class with this code already exists.', 409)
    }

    const teacherIds = await normalizeTeacherIds(assignedTeachers)

    const newClass = await Class.create({
      className: String(className).trim(),
      classCode: normalizedClassCode,
      trade: String(trade).trim(),
      level: String(level).trim(),
      academicYear: String(academicYear).trim(),
      assignedTeachers: teacherIds,
      schedule,
      status,
      description: String(description).trim()
    })

    return sendSuccess(res, newClass, 'Class created successfully.', 201)
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to create class.', 500)
  }
}

const updateClass = async (req, res) => {
  try {
    const classRecord = await Class.findById(req.params.id)

    if (!classRecord) {
      return sendError(res, 'Class not found.', 404)
    }

    const {
      className,
      classCode,
      trade,
      level,
      academicYear,
      assignedTeachers,
      schedule,
      status,
      description
    } = req.body

    if (schedule !== undefined && !isValidSchedule(schedule)) {
      return sendError(res, 'Each schedule session needs a valid day, start time, end time, and room of at most 60 characters.', 400)
    }

    if (className) classRecord.className = String(className).trim()
    if (classCode) classRecord.classCode = String(classCode).trim().toUpperCase()
    if (trade) classRecord.trade = String(trade).trim()
    if (level) classRecord.level = String(level).trim()
    if (academicYear) classRecord.academicYear = String(academicYear).trim()
    if (status) classRecord.status = status
    if (description !== undefined) classRecord.description = String(description).trim()
    if (assignedTeachers) classRecord.assignedTeachers = await normalizeTeacherIds(assignedTeachers)
    if (schedule !== undefined) classRecord.schedule = schedule

    await classRecord.save()

    const populated = await Class.findById(classRecord._id).populate('assignedTeachers', 'fullName email role').lean()
    return sendSuccess(res, populated, 'Class updated successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update class.', 500)
  }
}

const updateClassStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!status || !['active', 'inactive'].includes(status)) {
      return sendError(res, 'Status must be active or inactive.', 400)
    }

    const classRecord = await Class.findById(req.params.id)

    if (!classRecord) {
      return sendError(res, 'Class not found.', 404)
    }

    classRecord.status = status
    await classRecord.save()

    return sendSuccess(res, classRecord, 'Class status updated successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update class status.', 500)
  }
}

const deleteClass = async (req, res) => {
  try {
    const classRecord = await Class.findById(req.params.id)

    if (!classRecord) {
      return sendError(res, 'Class not found.', 404)
    }

    await classRecord.deleteOne()
    return sendSuccess(res, { id: req.params.id }, 'Class deleted successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to delete class.', 500)
  }
}

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  updateClassStatus,
  deleteClass,
  isValidSchedule
}
