const teacherClients = new Map()

const subscribeTeacherNotifications = (teacherId, response) => {
  const key = String(teacherId)
  const clients = teacherClients.get(key) || new Set()
  clients.add(response)
  teacherClients.set(key, clients)

  return () => {
    clients.delete(response)
    if (clients.size === 0) {
      teacherClients.delete(key)
    }
  }
}

const publishTeacherNotification = (teacherId, notification) => {
  const clients = teacherClients.get(String(teacherId))
  if (!clients) return

  const message = `data: ${JSON.stringify(notification)}\n\n`
  for (const response of clients) {
    if (response.destroyed || response.writableEnded) {
      clients.delete(response)
      continue
    }

    response.write(message)
  }

  if (clients.size === 0) {
    teacherClients.delete(String(teacherId))
  }
}

module.exports = { subscribeTeacherNotifications, publishTeacherNotification }
