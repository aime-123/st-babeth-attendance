const express = require('express')
const { login, getMe, updateMe, changePassword } = require('../controllers/authController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { loginValidator } = require('../validators/authValidator')
const { validateRequest } = require('../middleware/validateRequest')

const router = express.Router()

router.post('/login', loginValidator, validateRequest, login)
router.get('/me', authMiddleware, getMe)
router.patch('/me', authMiddleware, updateMe)
router.put('/change-password', authMiddleware, changePassword)

module.exports = router
