const errorMiddleware = (err, _req, res, _next) => {
  console.error(err)

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Unexpected server error.'
  })
}

module.exports = { errorMiddleware }
