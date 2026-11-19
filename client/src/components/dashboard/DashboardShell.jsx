import { createContext, useContext, useEffect, useState } from 'react'
import { BarChart3, Bell, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, FileClock, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquare, Moon, School, Send, Settings, ShieldCheck, Sun, UserCircle2, UserRound, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { prepareLogoImage } from '../../pages/settings/logoImage'

const teacherNavigationGroups = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/teacher' }]
  },
  {
    label: 'Teaching',
    items: [
      { label: 'My Classes', icon: GraduationCap, path: '/teacher/classes' },
      { label: 'My Timetable', icon: FileClock, path: '/teacher/timetable' }
    ]
  },
  {
    label: 'Attendance',
    items: [
      { label: 'Take Attendance', icon: ClipboardCheck, path: '/teacher/attendance' },
      { label: 'Attendance History', icon: Clock3, path: '/teacher/history' }
    ]
  }
]

const adminNavigationGroups = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/admin' }]
  },
  {
    label: 'School management',
    items: [
      { label: 'Class Management', icon: GraduationCap, path: '/admin/classes' },
      { label: 'Student Management', icon: Users, path: '/admin/students' },
      { label: 'Teacher Management', icon: UserRound, path: '/admin/teachers' },
      { label: 'Teacher Timetables', icon: FileClock, path: '/admin/timetables' }
    ]
  },
  {
    label: 'Attendance',
    items: [
      { label: 'Attendance History', icon: Clock3, path: '/admin/history' }
    ]
  },
  {
    label: 'Insights & settings',
    items: [
      { label: 'Reports', icon: BarChart3, path: '/admin/reports' },
      { label: 'Settings', icon: Settings, path: '/admin/settings' }
    ]
  }
]

const DashboardShellContext = createContext(false)

function DashboardShellFrame({ role, title, subtitle, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [collapsedNavigationGroups, setCollapsedNavigationGroups] = useState({})
  const [user, setUser] = useState(null)
  const [schoolSettings, setSchoolSettings] = useState({ schoolName: 'St Babeth TSS', logoDataUrl: '' })
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isNotificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [teacherNotifications, setTeacherNotifications] = useState([])
  const [teacherNotificationError, setTeacherNotificationError] = useState('')
  const [isMessageComposerOpen, setMessageComposerOpen] = useState(false)
  const [messageTitle, setMessageTitle] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageError, setMessageError] = useState('')
  const [messageSuccess, setMessageSuccess] = useState('')
  const [isSendingMessage, setSendingMessage] = useState(false)
  const [attendanceNotification, setAttendanceNotification] = useState(null)
  const [isDarkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return localStorage.getItem('st-babeth-theme') === 'dark'
    } catch (error) {
      console.warn('Unable to read the saved color mode.', error)
      return false
    }
  })
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const unreadNotificationsCount = isAdmin
    ? notifications.filter((item) => !item.readAt).length
    : teacherNotifications.filter((item) => !item.readAt).length
  const navigationGroups = isAdmin ? adminNavigationGroups : teacherNavigationGroups

  const getDisplayName = () => user?.fullName || (isAdmin ? 'System Administrator' : 'System User')
  const getInitials = (name = getDisplayName()) => name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST'

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail) setUser(event.detail)
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem('st-babeth-user') || 'null')
      setUser(storedUser)
    } catch (error) {
      console.warn('Unable to read the stored user profile.', error)
      setUser(null)
    }

    window.addEventListener('user-profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdated)
  }, [])

  useEffect(() => {
    if (!isAdmin) return undefined

    const token = localStorage.getItem('st-babeth-token')
    if (!token) return undefined

    let isCurrent = true
    let activeController
    let retryTimeout

    const connectToNotifications = async () => {
      const controller = new AbortController()
      activeController = controller
      let shouldRetry = true

      try {
        const baseUrl = api.defaults.baseURL.replace(/\/+$/, '')
        const response = await fetch(`${baseUrl}/notifications/stream`, {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        })

        if (!response.ok) {
          shouldRetry = response.status !== 401 && response.status !== 403
          throw new Error(`Notification stream returned ${response.status}.`)
        }

        if (!response.body) {
          throw new Error('Notification stream is not readable.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (isCurrent) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split(/\r?\n\r?\n/)
          buffer = events.pop() || ''

          for (const event of events) {
            const data = event
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n')

            if (!data) continue

            try {
              const notification = JSON.parse(data)
              if (notification.type === 'attendance-submitted') {
                setAttendanceNotification(notification)
                setNotifications((current) => {
                  const updated = [notification, ...current.filter((item) => item._id !== notification._id)]
                  return updated.slice(0, 50)
                })
              }
            } catch (error) {
              console.warn('Unable to read an admin notification.', error)
            }
          }
        }
      } catch (error) {
        if (isCurrent && error.name !== 'AbortError') {
          console.warn('Admin notification stream disconnected.', error)
        }
      } finally {
        if (isCurrent && shouldRetry) {
          retryTimeout = window.setTimeout(connectToNotifications, 5000)
        }
      }
    }

    connectToNotifications()

    return () => {
      isCurrent = false
      activeController?.abort()
      window.clearTimeout(retryTimeout)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isTeacher) return undefined

    let isCurrent = true
    let activeController
    let retryTimeout

    api.get('/notifications/teacher/messages')
      .then((response) => {
        const items = response.data?.data?.items
        if (isCurrent && Array.isArray(items)) {
          setTeacherNotificationError('')
          setTeacherNotifications((current) => {
            const merged = new Map()
            for (const notification of [...items, ...current]) {
              merged.set(notification._id, notification)
            }

            return Array.from(merged.values())
              .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
              .slice(0, 50)
          })
        }
      })
      .catch((error) => {
        console.warn('Unable to load teacher messages.', error)
        if (isCurrent) setTeacherNotificationError('Messages could not be loaded. Please try again later.')
      })

    const connectToTeacherMessages = async () => {
      const token = localStorage.getItem('st-babeth-token')
      if (!token) return

      const controller = new AbortController()
      activeController = controller
      let shouldRetry = true

      try {
        const baseUrl = api.defaults.baseURL.replace(/\/+$/, '')
        const response = await fetch(`${baseUrl}/notifications/teacher/messages/stream`, {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        })

        if (!response.ok) {
          shouldRetry = response.status !== 401 && response.status !== 403
          throw new Error(`Teacher message stream returned ${response.status}.`)
        }

        if (!response.body) {
          throw new Error('Teacher message stream is not readable.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (isCurrent) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split(/\r?\n\r?\n/)
          buffer = events.pop() || ''

          for (const event of events) {
            const data = event
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n')

            if (!data) continue

            try {
              const notification = JSON.parse(data)
              setTeacherNotifications((current) => [
                notification,
                ...current.filter((item) => item._id !== notification._id)
              ].slice(0, 50))
              setTeacherNotificationError('')
            } catch (error) {
              console.warn('Unable to read a teacher message.', error)
            }
          }
        }
      } catch (error) {
        if (isCurrent && error.name !== 'AbortError') {
          console.warn('Teacher message stream disconnected.', error)
        }
      } finally {
        if (isCurrent && shouldRetry) {
          retryTimeout = window.setTimeout(connectToTeacherMessages, 5000)
        }
      }
    }

    connectToTeacherMessages()

    return () => {
      isCurrent = false
      activeController?.abort()
      window.clearTimeout(retryTimeout)
    }
  }, [isTeacher])

  useEffect(() => {
    if (!isAdmin) return undefined

    let isCurrent = true
    api.get('/notifications')
      .then((response) => {
        const items = response.data?.data?.items
        if (isCurrent && Array.isArray(items)) {
          setNotifications((current) => {
            const merged = new Map()
            for (const notification of [...current, ...items]) {
              const key = notification._id || `${notification.teacherName}-${notification.className}-${notification.submittedAt}`
              merged.set(key, notification)
            }

            return Array.from(merged.values())
              .sort((first, second) => new Date(second.createdAt || second.submittedAt) - new Date(first.createdAt || first.submittedAt))
              .slice(0, 50)
          })
        }
      })
      .catch((error) => {
        console.warn('Unable to load admin notifications.', error)
        if (isCurrent) setNotificationError('Notifications could not be loaded. Please try again later.')
      })

    return () => {
      isCurrent = false
    }
  }, [isAdmin])

  useEffect(() => {
    let isCurrent = true

    const handleSchoolSettingsUpdated = (event) => {
      if (event.detail) {
        setSchoolSettings((current) => ({ ...current, ...event.detail }))
      }
    }

    window.addEventListener('school-settings-updated', handleSchoolSettingsUpdated)
    api.get('/settings/school')
      .then(async (response) => {
        const settings = { ...response.data.data }
        if (settings.logoDataUrl) {
          try {
            settings.logoDataUrl = await prepareLogoImage(settings.logoDataUrl)
          } catch (error) {
            console.warn('Unable to prepare the school logo for the dashboard menu.', error)
            settings.logoDataUrl = ''
          }
        }

        if (isCurrent) {
          setSchoolSettings((current) => ({ ...current, ...settings }))
        }
      })
      .catch((error) => {
        console.warn('Unable to load school branding.', error)
      })

    return () => {
      isCurrent = false
      window.removeEventListener('school-settings-updated', handleSchoolSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-profile-menu]')) {
        setProfileMenuOpen(false)
      }
      if (!event.target.closest('[data-notification-menu], [data-notification-panel]')) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isProfileMenuOpen && !isNotificationsOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotificationsOpen(false)
        const trigger = isNotificationsOpen
          ? '[data-notification-menu] > button'
          : '[data-profile-menu] > button'
        document.querySelector(trigger)?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isNotificationsOpen, isProfileMenuOpen])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)

    try {
      localStorage.setItem('st-babeth-theme', isDarkMode ? 'dark' : 'light')
    } catch (error) {
      console.warn('Unable to save the selected color mode.', error)
    }
  }, [isDarkMode])

  const handleLogout = () => {
    localStorage.removeItem('st-babeth-token')
    localStorage.removeItem('st-babeth-user')
    setProfileMenuOpen(false)
    navigate('/login')
  }

  const handleNotificationClick = async (notification) => {
    if (notification._id && !notification.readAt) {
      try {
        const response = await api.patch(`/notifications/${notification._id}/read`)
        const updatedNotification = response.data?.data
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? updatedNotification : item
        )))
      } catch (error) {
        console.warn('Unable to mark the notification as read.', error)
        setNotificationError('This notification could not be marked as read.')
      }
    }

    setNotificationsOpen(false)
    navigate('/admin/history')
  }

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => ({ ...item, readAt })))
      setNotificationError('')
    } catch (error) {
      console.warn('Unable to mark all notifications as read.', error)
      setNotificationError('Notifications could not be marked as read. Please try again.')
    }
  }

  const handleSendTeacherMessage = async (event) => {
    event.preventDefault()
    const title = messageTitle.trim()
    const message = messageBody.trim()

    if (title.length < 2 || message.length === 0) {
      setMessageError('Enter a title and message before sending.')
      return
    }

    setSendingMessage(true)
    setMessageError('')
    setMessageSuccess('')

    try {
      const response = await api.post('/notifications/messages', { title, message })
      const recipientCount = response.data?.data?.recipientCount
      setMessageTitle('')
      setMessageBody('')
      setMessageComposerOpen(false)
      setMessageSuccess(`Message sent to ${recipientCount} teacher${recipientCount === 1 ? '' : 's'}.`)
    } catch (error) {
      console.warn('Unable to send a message to teachers.', error)
      setMessageError(error.response?.data?.message || 'Message could not be sent. Please try again.')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleTeacherMessageRead = async (notification) => {
    if (!notification._id || notification.readAt) return

    try {
      const response = await api.patch(`/notifications/teacher/messages/${notification._id}/read`)
      const updatedNotification = response.data?.data
      setTeacherNotifications((current) => current.map((item) => (
        item._id === notification._id ? updatedNotification : item
      )))
      setTeacherNotificationError('')
    } catch (error) {
      console.warn('Unable to mark the teacher message as read.', error)
      setTeacherNotificationError('This message could not be marked as read.')
    }
  }

  const handleMarkAllTeacherMessagesRead = async () => {
    try {
      await api.patch('/notifications/teacher/messages/read-all')
      const readAt = new Date().toISOString()
      setTeacherNotifications((current) => current.map((item) => ({ ...item, readAt })))
      setTeacherNotificationError('')
    } catch (error) {
      console.warn('Unable to mark all teacher messages as read.', error)
      setTeacherNotificationError('Messages could not be marked as read. Please try again.')
    }
  }

  const handleSidebarToggle = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setDesktopSidebarOpen((previous) => !previous)
      return
    }

    setSidebarOpen((previous) => !previous)
  }

  return (
    <div className="min-h-screen bg-[var(--dashboard-canvas)] text-slate-900 dark:bg-[#061d1d] dark:text-slate-100">
      <div className="flex min-h-screen dark:bg-[#061d1d]">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
        />
      )}
        <aside
          id="dashboard-sidebar"
          className={`admin-sidebar ${isTeacher ? 'teacher-dashboard-sidebar' : ''} fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden border-r border-[#b8891e] bg-[#d6aa36] text-[#142b4a] shadow-[0_18px_40px_rgba(15,23,42,0.2)] transition-all duration-200 md:sticky md:inset-y-auto md:top-0 md:bottom-auto md:h-screen ${
            isDesktopSidebarOpen ? 'md:w-[270px]' : 'md:w-[76px]'
          } ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className={`flex shrink-0 items-center gap-3 border-b border-[#142b4a]/15 px-5 py-4 ${isDesktopSidebarOpen ? '' : 'md:justify-center md:px-2'}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#142b4a]/25 bg-white/20 text-[#142b4a]">
              {schoolSettings.logoDataUrl
                ? <img src={schoolSettings.logoDataUrl} alt="" className="h-full w-full rounded-full object-contain p-0.5" />
                : <School className="h-6 w-6" />}
            </div>
            <div className={isDesktopSidebarOpen ? 'min-w-0' : 'min-w-0 md:hidden'}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#142b4a]/70">School portal</p>
              <h2 className="truncate text-base font-bold tracking-tight text-[#142b4a]">{schoolSettings.schoolName}</h2>
              <p className="mt-0.5 text-xs text-[#142b4a]/70">Attendance dashboard</p>
            </div>
          </div>

          <nav className={`min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 ${isDesktopSidebarOpen ? '' : 'md:px-2'} ${isTeacher ? 'teacher-sidebar-nav' : ''}`} aria-label="Main navigation">
            {navigationGroups.map((group) => (
              <div key={group.label || role}>
                <button
                  type="button"
                  aria-expanded={!collapsedNavigationGroups[group.label]}
                  aria-controls={`navigation-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  title={!isDesktopSidebarOpen ? group.label : undefined}
                  onClick={() => setCollapsedNavigationGroups((current) => ({
                    ...current,
                    [group.label]: !current[group.label]
                  }))}
                  className={`mb-1 flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#142b4a]/75 transition-colors hover:bg-white/25 hover:text-[#142b4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b4a] ${isDesktopSidebarOpen ? '' : 'md:hidden'}`}
                >
                  {group.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsedNavigationGroups[group.label] ? '-rotate-90' : ''}`} aria-hidden="true" />
                </button>
                <div
                  id={`navigation-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  hidden={Boolean(collapsedNavigationGroups[group.label])}
                  className="space-y-0.5"
                >
                  {group.items.map(({ label, icon: Icon, path }) => {
                    const isActive = location.pathname === path

                    return (
                      <button
                        key={label}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        title={!isDesktopSidebarOpen ? label : undefined}
                        onClick={() => {
                          navigate(path)
                          setSidebarOpen(false)
                        }}
                        className={`admin-sidebar-link relative isolate flex w-full items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-1.5 text-left text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b4a] ${isDesktopSidebarOpen ? '' : 'md:justify-center md:px-0'} ${
                          isActive
                            ? 'border-[#142b4a] bg-[#142b4a] text-white shadow-sm ring-1 ring-white/15'
                            : 'border-transparent text-[#142b4a] hover:border-[#142b4a]/10 hover:bg-white/30 hover:text-[#142b4a]'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${isActive ? 'bg-white/15 text-white' : 'bg-white/35 text-[#142b4a] group-hover:bg-white/60'}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${isDesktopSidebarOpen ? '' : 'md:sr-only'}`}>{label}</span>
                        {isActive && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#f2c75c] ${isDesktopSidebarOpen ? '' : 'md:hidden'}`} aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={`mt-auto shrink-0 border-t border-[#142b4a]/15 p-4 ${isDesktopSidebarOpen ? '' : 'md:p-2'}`}>
            <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-white/25 p-3 ring-1 ring-inset ring-white/30 ${isDesktopSidebarOpen ? '' : 'md:justify-center md:px-0 md:py-2'}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-xs font-semibold uppercase text-[#142b4a]">
                {user?.profileImage
                  ? <img src={user.profileImage} alt="" className="h-full w-full rounded-full object-cover" />
                  : user?.fullName?.split(' ').slice(0, 2).map((part) => part[0]).join('') || 'ST'}
              </div>
              <div className={`min-w-0 flex-1 ${isDesktopSidebarOpen ? '' : 'md:hidden'}`}>
                <p className="truncate text-sm font-semibold text-[#142b4a]">{user?.fullName || 'System User'}</p>
                <p className="text-xs capitalize text-[#142b4a]/70">{role}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className={`flex min-h-10 w-full items-center justify-start gap-2 rounded-xl border border-[#142b4a]/25 bg-transparent px-4 py-2.5 text-sm font-medium text-[#142b4a] transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#142b4a] ${isDesktopSidebarOpen ? '' : 'md:px-0'}`}
              aria-label="Logout"
              title={!isDesktopSidebarOpen ? 'Logout' : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span className={isDesktopSidebarOpen ? '' : 'md:sr-only'}>Logout</span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="dashboard-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(22,71,64,0.96),_rgba(7,30,29,0.99)_52%,_rgba(5,21,20,1)_100%)] dark:text-white dark:shadow-[0_10px_24px_rgba(7,25,24,0.14)]">
            <div className="flex min-h-[82px] items-center justify-between px-4 py-2.5 md:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  aria-controls="dashboard-sidebar"
                  title="Toggle navigation menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-amber-300 dark:hover:bg-white/10 dark:focus-visible:ring-amber-300"
                  onClick={handleSidebarToggle}
                >
                  <span className="md:hidden">
                    {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </span>
                  <span className="hidden md:block">
                    {isDesktopSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </span>
                </button>
                <div className="min-w-0">
                  <p className="dashboard-header-subtitle text-[10px] font-bold uppercase tracking-[0.26em] text-emerald-800 dark:text-emerald-100/80">{subtitle}</p>
                  <h1 className="dashboard-header-title mt-1 text-2xl font-bold tracking-[-0.04em] text-emerald-950 dark:text-white md:text-4xl">{title}</h1>
                </div>
              </div>

              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode((previous) => !previous)}
                  className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-amber-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 dark:border-white/20 dark:bg-white/8 dark:text-[#f5d77e] dark:hover:border-[#f5d77e] dark:hover:bg-white/12 dark:focus-visible:ring-amber-300 dark:focus-visible:ring-offset-[#0b1f1d]"
                  aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-checked={isDarkMode}
                  role="switch"
                  title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDarkMode
                    ? <Moon className="h-5 w-5 transition-transform duration-200 group-hover:-rotate-12" strokeWidth={2} aria-hidden="true" />
                    : <Sun className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45" strokeWidth={2} aria-hidden="true" />}
                </button>
                {(isAdmin || isTeacher) && (
                  <div data-notification-menu>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen((previous) => !previous)}
                      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/20 dark:bg-white/8 dark:text-[#f5d77e] dark:hover:border-[#f5d77e] dark:hover:bg-white/12 dark:focus-visible:ring-amber-300 dark:focus-visible:ring-offset-[#0b1f1d]"
                      aria-label={`Notifications${unreadNotificationsCount ? `, ${unreadNotificationsCount} unread` : ''}`}
                      aria-expanded={isNotificationsOpen}
                      aria-controls={isAdmin ? 'admin-notifications-panel' : 'teacher-notifications-panel'}
                    >
                      <Bell className="h-5 w-5" aria-hidden="true" />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">
                          {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                <div className="relative" data-profile-menu>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((previous) => !previous)}
                    className="group flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-2 py-1.5 text-slate-700 shadow-sm shadow-slate-900/10 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:translate-y-0 dark:border-white/15 dark:bg-white/8 dark:focus-visible:ring-emerald-400"
                    aria-expanded={isProfileMenuOpen}
                    aria-controls="dashboard-account-menu"
                    aria-label={`Open account menu for ${getDisplayName()}`}
                    aria-haspopup="true"
                  >
                    <span className="dashboard-account-avatar flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#dfeaf9] to-[#cfe1ff] text-[11px] font-bold text-slate-700 shadow-inner shadow-white/60 ring-1 ring-slate-300/70">
                      {user?.profileImage
                        ? <img src={user.profileImage} alt="" className="h-full w-full rounded-full object-cover" />
                        : getInitials()}
                    </span>
                    <span className="hidden text-left md:block">
                      <span className="block text-[15px] font-medium leading-none text-slate-800 dark:text-slate-100">{getDisplayName()}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 group-hover:text-emerald-700 dark:text-slate-300 dark:group-hover:text-emerald-300 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isProfileMenuOpen && (
                    <div id="dashboard-account-menu" className="dashboard-account-menu absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.48)] ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
                      <div className="dashboard-account-banner rounded-xl p-4 text-white shadow-inner shadow-white/5 dark:shadow-none">
                        <div className="flex items-center gap-3">
                          <span className="dashboard-account-menu-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner shadow-white/20 ring-1 ring-white/25">
                            {user?.profileImage
                              ? <img src={user.profileImage} alt="" className="h-full w-full rounded-full object-cover" />
                              : getInitials()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100/80">Signed in as</p>
                            <p className="truncate text-sm font-semibold tracking-tight text-white">{getDisplayName()}</p>
                            <span className="mt-1 inline-flex rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                              {isAdmin ? 'Administrator' : role}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="px-1 pb-1 pt-3">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Account</p>
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false)
                              navigate(isAdmin ? '/admin/profile' : '/teacher/profile')
                            }}
                            className="dashboard-account-action group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:text-emerald-300"
                          >
                            <span className="dashboard-account-action-icon flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-emerald-300">
                              <UserCircle2 className="h-4 w-4" />
                            </span>
                            My profile
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false)
                              navigate(isAdmin ? '/admin/security' : '/teacher/security')
                            }}
                            className="dashboard-account-action group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:text-emerald-300"
                          >
                            <span className="dashboard-account-action-icon flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-emerald-300">
                              <ShieldCheck className="h-4 w-4" />
                            </span>
                            Security & access
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setProfileMenuOpen(false)
                                navigate('/admin/settings')
                              }}
                              className="dashboard-account-action group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:text-emerald-300"
                            >
                              <span className="dashboard-account-action-icon flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:text-emerald-800 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-emerald-300">
                                <Settings className="h-4 w-4" />
                              </span>
                              Settings
                            </button>
                          )}
                        </div>
                        <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="dashboard-account-logout group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm font-semibold text-rose-700 transition duration-150 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300"
                        >
                          <span className="dashboard-account-logout-icon flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors dark:bg-rose-900/40 dark:text-rose-300">
                            <LogOut className="h-4 w-4" />
                          </span>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {isAdmin && isNotificationsOpen && (
                  <section
                    id="admin-notifications-panel"
                    data-notification-panel
                    aria-label="Teacher attendance notifications"
                    className="absolute right-0 top-full z-[70] mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-700">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Teacher attendance</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Updates when a teacher submits a class register.</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMessageComposerOpen((previous) => !previous)
                            setMessageError('')
                            setMessageSuccess('')
                          }}
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          aria-expanded={isMessageComposerOpen}
                        >
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Send message
                        </button>
                        {notifications.some((item) => !item.readAt) && (
                          <button
                            type="button"
                            onClick={handleMarkAllNotificationsRead}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-200 dark:hover:bg-slate-800"
                          >
                            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                    {messageSuccess && (
                      <p className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
                        {messageSuccess}
                      </p>
                    )}
                    {isMessageComposerOpen && (
                      <form onSubmit={handleSendTeacherMessage} className="mx-3 mt-3 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/25">
                        <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">This message will be sent to all active teachers.</p>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Title
                          <input
                            value={messageTitle}
                            onChange={(event) => setMessageTitle(event.target.value)}
                            maxLength={120}
                            required
                            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/50"
                            aria-label="Message title"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Message
                          <textarea
                            value={messageBody}
                            onChange={(event) => setMessageBody(event.target.value)}
                            maxLength={2000}
                            rows={3}
                            required
                            className="mt-1 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/50"
                            aria-label="Message to teachers"
                          />
                        </label>
                        {messageError && <p className="text-xs font-medium text-rose-700 dark:text-rose-300" role="alert">{messageError}</p>}
                        <button
                          type="submit"
                          disabled={isSendingMessage}
                          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          {isSendingMessage ? 'Sending…' : 'Send to teachers'}
                        </button>
                      </form>
                    )}
                    {notificationError && (
                      <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
                        {notificationError}
                      </p>
                    )}
                    <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-2">
                      {notifications.length > 0 ? notifications.slice(0, 10).map((notification, index) => (
                        <button
                          key={notification._id || `${notification.teacherName}-${notification.className}-${index}`}
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800 ${notification.readAt ? 'dark:bg-slate-900' : 'bg-emerald-50/70 dark:bg-emerald-950/35'}`}
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              <span className="truncate">{notification.teacherName} submitted attendance</span>
                              {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Unread" />}
                            </span>
                            <span className="mt-1 block truncate text-xs text-slate-600 dark:text-slate-300">{notification.className}</span>
                            <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                              {notification.studentCount} students · {notification.attendanceDate}
                            </span>
                          </span>
                        </button>
                      )) : (
                        <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          No teacher attendance notifications yet.
                        </p>
                      )}
                    </div>
                    <div className="border-t border-slate-100 p-2 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false)
                          navigate('/admin/history')
                        }}
                        className="flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-200 dark:hover:bg-slate-800"
                      >
                        View attendance history
                      </button>
                    </div>
                  </section>
                )}
                {isTeacher && isNotificationsOpen && (
                  <section
                    id="teacher-notifications-panel"
                    data-notification-panel
                    aria-label="Messages from school administration"
                    className="absolute right-0 top-full z-[70] mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-700">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Messages from administration</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Important updates from your school.</p>
                      </div>
                      {teacherNotifications.some((item) => !item.readAt) && (
                        <button
                          type="button"
                          onClick={handleMarkAllTeacherMessagesRead}
                          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    {teacherNotificationError && (
                      <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
                        {teacherNotificationError}
                      </p>
                    )}
                    <div className="max-h-[min(65vh,28rem)] space-y-2 overflow-y-auto p-3">
                      {teacherNotifications.length > 0 ? teacherNotifications.map((notification) => (
                        <article
                          key={notification._id}
                          className={`rounded-xl border p-3 ${notification.readAt ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/25'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{notification.title}</h3>
                            {!notification.readAt && (
                              <span className="shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700 dark:text-slate-300">{notification.message}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            {notification.createdAt && (
                              <time className="text-[11px] text-slate-500 dark:text-slate-400" dateTime={notification.createdAt}>
                                {new Date(notification.createdAt).toLocaleString()}
                              </time>
                            )}
                            {!notification.readAt && (
                              <button
                                type="button"
                                onClick={() => handleTeacherMessageRead(notification)}
                                className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-200 dark:hover:bg-slate-800"
                              >
                                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                Mark as read
                              </button>
                            )}
                          </div>
                        </article>
                      )) : (
                        <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          No messages from administration yet.
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </header>

          {isAdmin && attendanceNotification && (
            <div className="pointer-events-none fixed right-4 top-[82px] z-[80] w-[min(26rem,calc(100vw-2rem))]" role="status" aria-live="polite">
              <div className="attendance-notification-toast pointer-events-auto rounded-2xl border p-4 shadow-xl">
                <div className="flex items-start gap-3">
                  <span className="attendance-notification-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">Attendance submitted</p>
                    <p className="mt-1 text-sm leading-5">
                      {attendanceNotification.teacherName} submitted attendance for {attendanceNotification.className}.
                    </p>
                    <p className="mt-1 text-xs">
                      {attendanceNotification.studentCount} students · {attendanceNotification.attendanceDate}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttendanceNotification(null)}
                    aria-label="Dismiss attendance notification"
                    className="attendance-notification-dismiss flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceNotification(null)
                    navigate('/admin/history')
                  }}
                  className="attendance-notification-link mt-3 inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  View attendance history
                </button>
              </div>
            </div>
          )}

          <main className="dashboard-content dashboard-page p-4 md:p-6 xl:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

function DashboardShell(props) {
  const isInsideDashboardShell = useContext(DashboardShellContext)

  if (isInsideDashboardShell) {
    return props.children
  }

  return (
    <DashboardShellContext.Provider value>
      <DashboardShellFrame {...props} />
    </DashboardShellContext.Provider>
  )
}

export default DashboardShell
