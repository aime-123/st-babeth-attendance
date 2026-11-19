export const getPostLoginPath = (role, requestedLocation) => {
  const dashboardPath = role === 'admin' ? '/admin' : '/teacher'
  const requestedPath = requestedLocation?.pathname
  const matchesRole = requestedPath === dashboardPath || (
    typeof requestedPath === 'string' && requestedPath.startsWith(`${dashboardPath}/`)
  )

  if (!matchesRole) {
    return dashboardPath
  }

  const search = typeof requestedLocation.search === 'string' ? requestedLocation.search : ''
  const hash = typeof requestedLocation.hash === 'string' ? requestedLocation.hash : ''
  return `${requestedPath}${search}${hash}`
}
