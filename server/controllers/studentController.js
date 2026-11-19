const Student = require('../models/Student')
const Class = require('../models/Class')
const { sendSuccess, sendError } = require('../utils/response')

const normalizeSdmsNumber = (value) => String(value).trim().toLocaleUpperCase()
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isValidSdmsNumber = (value) => /^\d+$/.test(String(value).trim())
const normalizeRwandaPhone = (value) => {
  const phone = String(value).trim()
  if (/^\+250\d{9}$/.test(phone)) return phone
  if (/^0\d{9}$/.test(phone)) return `+250${phone.slice(1)}`
  return null
}

const resolveAccessibleClassIds = async (user) => {
  if (user.role === 'admin') {
    return null
  }

  const classes = await Class.find({ assignedTeachers: user.id }).select('_id')
  return classes.map((schoolClass) => schoolClass._id)
}

const getStudents = async (req, res) => {
  try {
    const { q, status, classId, academicYear } = req.query
    const query = {}

    if (req.user.role === 'teacher') {
      const accessibleClassIds = await resolveAccessibleClassIds(req.user)
      query.classId = { $in: accessibleClassIds }
    }

    if (classId) {
      query.classId = classId
    }

    if (status) {
      query.status = status
    }

    if (academicYear) {
      query.academicYear = academicYear
    }

    if (q) {
      query.$or = [
        { firstName: new RegExp(q, 'i') },
        { lastName: new RegExp(q, 'i') },
        { registrationNumber: new RegExp(q, 'i') }
      ]
    }

    const students = await Student.find(query)
      .populate('classId', 'className classCode level trade')
      .sort({ createdAt: -1 })
      .lean()

    return sendSuccess(res, students, 'Students fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch students.', 500)
  }
}

const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId', 'className classCode level trade assignedTeachers').lean()

    if (!student) {
      return sendError(res, 'Student not found.', 404)
    }

    if (req.user.role === 'teacher') {
      const assignedClassIds = await resolveAccessibleClassIds(req.user)
      if (!assignedClassIds.includes(String(student.classId?._id || student.classId))) {
        return sendError(res, 'You are not assigned to this student class.', 403)
      }
    }

    return sendSuccess(res, student, 'Student fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch student.', 500)
  }
}

const createStudent = async (req, res) => {
  try {
    const {
      registrationNumber,
      firstName,
      lastName,
      guardianName,
      guardianPhone,
      gender,
      classId,
      academicYear,
      enrollmentDate,
      status = 'active'
    } = req.body

    if (!registrationNumber || !firstName || !lastName || !guardianName || !guardianPhone || !gender || !classId || !academicYear || !enrollmentDate) {
      return sendError(res, 'SDMS number, student name, parent or guardian name and phone, gender, class, academic year, and enrollment date are required.', 400)
    }

    if (!isValidSdmsNumber(registrationNumber)) {
      return sendError(res, 'SDMS number must contain digits only.', 400)
    }

    const normalizedGuardianPhone = normalizeRwandaPhone(guardianPhone)
    if (!normalizedGuardianPhone) {
      return sendError(res, 'Guardian phone must use +250 followed by 9 digits, or 10 local digits starting with 0.', 400)
    }

    if (String(guardianName).trim().length > 120) {
      return sendError(res, 'Parent or guardian name must be 120 characters or fewer.', 400)
    }

    const schoolClass = await Class.findById(classId)

    if (!schoolClass) {
      return sendError(res, 'Selected class does not exist.', 404)
    }

    if (req.user.role === 'teacher' && !schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(req.user.id))) {
      return sendError(res, 'You can only register students in your assigned classes.', 403)
    }

    const normalizedRegistrationNumber = normalizeSdmsNumber(registrationNumber)
    const existingStudent = await Student.findOne({
      registrationNumber: new RegExp(`^${escapeRegex(normalizedRegistrationNumber)}$`, 'i')
    })
    if (existingStudent) {
      return sendError(res, 'A student with this SDMS number already exists. Enter a unique SDMS number.', 409)
    }

    const student = await Student.create({
      registrationNumber: normalizedRegistrationNumber,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      guardianName: String(guardianName).trim(),
      guardianPhone: normalizedGuardianPhone,
      gender,
      classId,
      academicYear: String(academicYear).trim(),
      enrollmentDate: new Date(enrollmentDate),
      status
    })

    const populatedStudent = await Student.findById(student._id).populate('classId', 'className classCode level trade').lean()
    return sendSuccess(res, populatedStudent, 'Student created successfully.', 201)
  } catch (error) {
    if (error.code === 11000 && (error.keyPattern?.registrationNumber || error.keyValue?.registrationNumber)) {
      return sendError(res, 'A student with this SDMS number already exists. Enter a unique SDMS number.', 409)
    }

    console.error(error)
    return sendError(res, 'Unable to create student.', 500)
  }
}

const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)

    if (!student) {
      return sendError(res, 'Student not found.', 404)
    }

    if (req.user.role === 'teacher') {
      const schoolClass = await Class.findById(student.classId)
      if (!schoolClass || !schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(req.user.id))) {
        return sendError(res, 'You are not allowed to edit this student.', 403)
      }
    }

    const {
      registrationNumber,
      firstName,
      lastName,
      guardianName,
      guardianPhone,
      gender,
      classId,
      academicYear,
      enrollmentDate,
      status
    } = req.body

    if (registrationNumber) {
      if (!isValidSdmsNumber(registrationNumber)) {
        return sendError(res, 'SDMS number must contain digits only.', 400)
      }

      const normalizedRegistrationNumber = normalizeSdmsNumber(registrationNumber)
      const existingStudent = await Student.findOne({
        _id: { $ne: student._id },
        registrationNumber: new RegExp(`^${escapeRegex(normalizedRegistrationNumber)}$`, 'i')
      })
      if (existingStudent) {
        return sendError(res, 'A student with this SDMS number already exists. Enter a unique SDMS number.', 409)
      }
      student.registrationNumber = normalizedRegistrationNumber
    }
    if (firstName) student.firstName = String(firstName).trim()
    if (lastName) student.lastName = String(lastName).trim()
    if (guardianName !== undefined) {
      if (typeof guardianName !== 'string' || guardianName.trim().length > 120) {
        return sendError(res, 'Parent or guardian name must be 120 characters or fewer.', 400)
      }
      student.guardianName = guardianName.trim()
    }
    if (guardianPhone !== undefined) {
      const normalizedGuardianPhone = typeof guardianPhone === 'string' ? normalizeRwandaPhone(guardianPhone) : null
      if (!normalizedGuardianPhone) {
        return sendError(res, 'Guardian phone must use +250 followed by 9 digits, or 10 local digits starting with 0.', 400)
      }
      student.guardianPhone = normalizedGuardianPhone
    }
    if (gender) student.gender = gender
    if (classId) {
      const schoolClass = await Class.findById(classId)
      if (!schoolClass) {
        return sendError(res, 'Selected class does not exist.', 404)
      }
      if (req.user.role === 'teacher' && !schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(req.user.id))) {
        return sendError(res, 'You can only assign students to your own classes.', 403)
      }
      student.classId = classId
    }
    if (academicYear) student.academicYear = String(academicYear).trim()
    if (enrollmentDate) student.enrollmentDate = new Date(enrollmentDate)
    if (status) student.status = status

    await student.save()

    const updatedStudent = await Student.findById(student._id).populate('classId', 'className classCode level trade').lean()
    return sendSuccess(res, updatedStudent, 'Student updated successfully.')
  } catch (error) {
    if (error.code === 11000 && (error.keyPattern?.registrationNumber || error.keyValue?.registrationNumber)) {
      return sendError(res, 'A student with this SDMS number already exists. Enter a unique SDMS number.', 409)
    }

    console.error(error)
    return sendError(res, 'Unable to update student.', 500)
  }
}

const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body

    if (!status || !['active', 'inactive'].includes(status)) {
      return sendError(res, 'Status must be active or inactive.', 400)
    }

    const student = await Student.findById(req.params.id)
    if (!student) {
      return sendError(res, 'Student not found.', 404)
    }

    if (req.user.role === 'teacher') {
      const schoolClass = await Class.findById(student.classId)
      if (!schoolClass || !schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(req.user.id))) {
        return sendError(res, 'You are not allowed to change this student status.', 403)
      }
    }

    student.status = status
    await student.save()

    return sendSuccess(res, student, 'Student status updated successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update student status.', 500)
  }
}

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
    if (!student) {
      return sendError(res, 'Student not found.', 404)
    }

    if (req.user.role === 'teacher') {
      const schoolClass = await Class.findById(student.classId)
      if (!schoolClass || !schoolClass.assignedTeachers.some((teacherId) => String(teacherId) === String(req.user.id))) {
        return sendError(res, 'You are not allowed to delete this student.', 403)
      }
    }

    await student.deleteOne()
    return sendSuccess(res, { id: req.params.id }, 'Student deleted successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to delete student.', 500)
  }
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent
}
