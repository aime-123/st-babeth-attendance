const adminClients = new Set()

const subscribeAdminNotifications = (response) => {
  adminClients.add(response)
  return () => adminClients.delete(response)
}

const publishAdminNotification = (notification) => {
  const message = `data: ${JSON.stringify(notification)}\n\n`

  for (const response of adminClients) {
    if (response.destroyed || response.writableEnded) {
      adminClients.delete(response)
      continue
    }

    response.write(message)
  }
}

module.exports = { subscribeAdminNotifications, publishAdminNotification }
