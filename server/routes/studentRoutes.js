const express = require('express')
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent
} = require('../controllers/studentController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/', authMiddleware, authorizeRoles('admin', 'teacher'), getStudents)
router.get('/:id', authMiddleware, authorizeRoles('admin', 'teacher'), getStudentById)
router.post('/', authMiddleware, authorizeRoles('admin', 'teacher'), createStudent)
router.put('/:id', authMiddleware, authorizeRoles('admin', 'teacher'), updateStudent)
router.patch('/:id/status', authMiddleware, authorizeRoles('admin', 'teacher'), updateStudentStatus)
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'teacher'), deleteStudent)

module.exports = router
