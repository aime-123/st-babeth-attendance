const mongoose = require('mongoose')
const User = require('../models/User')
const Class = require('../models/Class')
const { sendSuccess, sendError } = require('../utils/response')

const MAX_TIMETABLE_FILE_SIZE = 2 * 1024 * 1024

const getTimetableDocument = (document, includeContent = false) => {
  if (!document?.fileName) {
    return null
  }

  return {
    fileName: document.fileName,
    contentType: document.contentType || 'application/octet-stream',
    uploadedAt: document.uploadedAt,
    ...(includeContent ? { contentBase64: document.contentBase64 } : {})
  }
}

const normalizeClassIds = async (classIds) => {
  if (!Array.isArray(classIds)) {
    return { error: 'Assigned classes must be provided as a list.' }
  }

  const uniqueIds = [...new Set(classIds.map((id) => String(id)))]
  if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return { error: 'One or more selected classes are invalid.' }
  }

  const classes = await Class.find({ _id: { $in: uniqueIds } }).select('_id').lean()
  if (classes.length !== uniqueIds.length) {
    return { error: 'One or more selected classes do not exist.' }
  }

  return { classIds: classes.map((schoolClass) => schoolClass._id) }
}

const replaceTeacherClasses = async (teacherId, classIds) => {
  await Class.updateMany(
    { assignedTeachers: teacherId, _id: { $nin: classIds } },
    { $pull: { assignedTeachers: teacherId } }
  )

  if (classIds.length > 0) {
    await Class.updateMany(
      { _id: { $in: classIds } },
      { $addToSet: { assignedTeachers: teacherId } }
    )
  }
}

const getUsers = async (req, res) => {
  try {
    const { role, status, q } = req.query

    const query = {}

    if (role) {
      query.role = role
    }

    if (status) {
      query.status = status
    }

    if (q) {
      query.$or = [
        { fullName: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { username: new RegExp(q, 'i') }
      ]
    }

    const users = await User.find(query)
      .select('-password -profileImage -timetableDocument.contentBase64')
      .sort({ createdAt: -1 })
      .lean()

    if (role !== 'teacher') {
      return sendSuccess(res, users, 'Users fetched successfully.')
    }

    const userIds = users.map((user) => user._id)
    const classRecords = await Class.find({ assignedTeachers: { $in: userIds } })
      .select('_id assignedTeachers')
      .lean()
    const classesByTeacher = new Map(userIds.map((userId) => [String(userId), []]))

    classRecords.forEach((schoolClass) => {
      schoolClass.assignedTeachers.forEach((teacherId) => {
        const assignedClasses = classesByTeacher.get(String(teacherId))
        if (assignedClasses) {
          assignedClasses.push(schoolClass._id)
        }
      })
    })

    const teachers = users.map((user) => ({
      ...user,
      timetableDocument: getTimetableDocument(user.timetableDocument),
      permissions: {
        canMarkAttendance: user.permissions?.canMarkAttendance !== false
      },
      assignedClassIds: classesByTeacher.get(String(user._id)) || []
    }))

    return sendSuccess(res, teachers, 'Users fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch users.', 500)
  }
}

const getMyTimetable = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.user.id, role: 'teacher' }).select('timetableDocument').lean()
    if (!teacher) {
      return sendError(res, 'Teacher not found.', 404)
    }

    return sendSuccess(res, getTimetableDocument(teacher.timetableDocument, true), 'Timetable fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch your timetable.', 500)
  }
}

const getTeacherTimetable = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' }).select('timetableDocument').lean()
    if (!teacher) {
      return sendError(res, 'Teacher not found.', 404)
    }

    return sendSuccess(res, getTimetableDocument(teacher.timetableDocument, true), 'Timetable fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch the teacher timetable.', 500)
  }
}

const uploadTeacherTimetable = async (req, res) => {
  try {
    const { fileName: rawFileName, contentType, contentBase64 } = req.body || {}
    const fileName = typeof rawFileName === 'string'
      ? rawFileName.replace(/[\\/]/g, '/').split('/').pop().trim()
      : ''

    if (
      !fileName ||
      fileName.length > 255 ||
      /[\u0000-\u001f\u007f]/.test(fileName) ||
      typeof contentBase64 !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64) ||
      !contentBase64
    ) {
      return sendError(res, 'Choose a valid timetable file to upload.', 400)
    }

    const fileBuffer = Buffer.from(contentBase64, 'base64')
    if (fileBuffer.length === 0 || fileBuffer.length > MAX_TIMETABLE_FILE_SIZE || fileBuffer.toString('base64') !== contentBase64) {
      return sendError(res, 'Timetable files must be 2 MB or smaller.', 400)
    }

    const normalizedContentType = typeof contentType === 'string' &&
      contentType.length <= 127 &&
      /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(contentType)
      ? contentType
      : 'application/octet-stream'

    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
    if (!teacher) {
      return sendError(res, 'Teacher not found.', 404)
    }

    teacher.timetableDocument = {
      fileName,
      contentType: normalizedContentType,
      contentBase64,
      uploadedAt: new Date()
    }
    await teacher.save()

    return sendSuccess(res, getTimetableDocument(teacher.timetableDocument), 'Teacher timetable uploaded successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to upload the teacher timetable.', 500)
  }
}

const deleteTeacherTimetable = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
    if (!teacher) {
      return sendError(res, 'Teacher not found.', 404)
    }

    teacher.timetableDocument = {
      fileName: '',
      contentType: 'application/octet-stream',
      contentBase64: '',
      uploadedAt: null
    }
    await teacher.save()

    return sendSuccess(res, null, 'Teacher timetable removed successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to remove the teacher timetable.', 500)
  }
}

const createTeacher = async (req, res) => {
  try {
    const { fullName, email, username, password, classIds = [], permissions = {} } = req.body

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) ||
      typeof password !== 'string' ||
      !password
    ) {
      return sendError(res, 'A valid name, email, username, and initial password are required.', 400)
    }

    if (password.length < 8) {
      return sendError(res, 'The initial password must be at least 8 characters.', 400)
    }

    if (!permissions || typeof permissions.canMarkAttendance !== 'boolean') {
      return sendError(res, 'Attendance permission must be explicitly selected.', 400)
    }

    const normalized = await normalizeClassIds(classIds)
    if (normalized.error) {
      return sendError(res, normalized.error, 400)
    }

    const teacher = await User.create({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      role: 'teacher',
      permissions: { canMarkAttendance: permissions.canMarkAttendance }
    })

    await replaceTeacherClasses(teacher._id, normalized.classIds)

    const result = teacher.toObject()
    delete result.password
    delete result.profileImage
    result.assignedClassIds = normalized.classIds
    return sendSuccess(res, result, 'Teacher registered successfully.', 201)
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = error.keyPattern?.username || error.keyValue?.username ? 'username' : 'email'
      return sendError(res, `A user with this ${duplicateField} already exists.`, 409)
    }

    console.error(error)
    return sendError(res, 'Unable to register teacher.', 500)
  }
}

const updateTeacher = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
    if (!teacher) {
      return sendError(res, 'Teacher not found.', 404)
    }

    const { fullName, email, classIds, permissions } = req.body
    if (fullName !== undefined && String(fullName).trim().length < 2) {
      return sendError(res, 'Teacher name must be at least 2 characters.', 400)
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return sendError(res, 'Enter a valid teacher email address.', 400)
      }
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: teacher._id } })
      if (existingUser) {
        return sendError(res, 'A user with this email already exists.', 409)
      }
      teacher.email = normalizedEmail
    }

    if (permissions && typeof permissions.canMarkAttendance !== 'boolean') {
      return sendError(res, 'Attendance permission must be a boolean.', 400)
    }

    let normalizedClassIds
    if (classIds !== undefined) {
      const normalized = await normalizeClassIds(classIds)
      if (normalized.error) {
        return sendError(res, normalized.error, 400)
      }
      normalizedClassIds = normalized.classIds
    }

    if (fullName !== undefined) {
      teacher.fullName = String(fullName).trim()
    }
    if (permissions) {
      teacher.permissions.canMarkAttendance = permissions.canMarkAttendance
    }

    await teacher.save()
    if (normalizedClassIds) {
      await replaceTeacherClasses(teacher._id, normalizedClassIds)
    }

    const result = teacher.toObject()
    delete result.password
    delete result.profileImage
    result.assignedClassIds = normalizedClassIds || (
      await Class.find({ assignedTeachers: teacher._id }).distinct('_id')
    )
    return sendSuccess(res, result, 'Teacher updated successfully.')
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'A user with this email already exists.', 409)
    }
    console.error(error)
    return sendError(res, 'Unable to update teacher.', 500)
  }
}

module.exports = {
  getUsers,
  getMyTimetable,
  getTeacherTimetable,
  uploadTeacherTimetable,
  deleteTeacherTimetable,
  createTeacher,
  updateTeacher
}
