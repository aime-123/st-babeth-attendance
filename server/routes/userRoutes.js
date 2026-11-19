const express = require('express')
const {
  getUsers,
  getMyTimetable,
  getTeacherTimetable,
  uploadTeacherTimetable,
  deleteTeacherTimetable,
  createTeacher,
  updateTeacher
} = require('../controllers/userController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/me/timetable', authMiddleware, authorizeRoles('teacher'), getMyTimetable)
router.get('/', authMiddleware, authorizeRoles('admin'), getUsers)
router.post('/', authMiddleware, authorizeRoles('admin'), createTeacher)
router.get('/:id/timetable', authMiddleware, authorizeRoles('admin'), getTeacherTimetable)
router.put('/:id/timetable', authMiddleware, authorizeRoles('admin'), uploadTeacherTimetable)
router.delete('/:id/timetable', authMiddleware, authorizeRoles('admin'), deleteTeacherTimetable)
router.patch('/:id', authMiddleware, authorizeRoles('admin'), updateTeacher)

module.exports = router
