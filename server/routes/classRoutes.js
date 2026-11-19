const express = require('express')
const {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  updateClassStatus,
  deleteClass
} = require('../controllers/classController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/', authMiddleware, authorizeRoles('admin', 'teacher'), getClasses)
router.get('/:id', authMiddleware, authorizeRoles('admin', 'teacher'), getClassById)
router.post('/', authMiddleware, authorizeRoles('admin'), createClass)
router.put('/:id', authMiddleware, authorizeRoles('admin'), updateClass)
router.patch('/:id/status', authMiddleware, authorizeRoles('admin'), updateClassStatus)
router.delete('/:id', authMiddleware, authorizeRoles('admin'), deleteClass)

module.exports = router
