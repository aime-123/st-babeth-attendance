import { useEffect, useState } from 'react'
import {
  ArrowRight,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  MapPin,
  UserCheck,
  UserX,
  Users
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DashboardShell from '../../components/dashboard/DashboardShell'
import api from '../../services/api'

const statStyles = {
  blue: {
    icon: Users,
    color: 'text-blue-700 dark:text-blue-300',
    background: 'bg-blue-50 dark:bg-blue-950/40',
    edge: 'bg-blue-500 dark:bg-blue-400'
  },
  green: {
    icon: UserCheck,
    color: 'text-emerald-700 dark:text-emerald-300',
    background: 'bg-emerald-50 dark:bg-emerald-950/40',
    edge: 'bg-emerald-500 dark:bg-emerald-400'
  },
  amber: {
    icon: UserX,
    color: 'text-amber-700 dark:text-amber-300',
    background: 'bg-amber-50 dark:bg-amber-950/40',
    edge: 'bg-amber-500 dark:bg-amber-400'
  },
  red: {
    icon: BarChart3,
    color: 'text-rose-700 dark:text-rose-300',
    background: 'bg-rose-50 dark:bg-rose-950/35',
    edge: 'bg-rose-500 dark:bg-rose-400'
  }
}

const weekdayNumbers = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
}

function getNextScheduleSession(schedule, now) {
  return schedule
    .map((session) => {
      const sessionDay = weekdayNumbers[session.day]
      if (sessionDay === undefined) {
        return null
      }

      let daysUntil = (sessionDay - now.getDay() + 7) % 7
      const startsAt = new Date(now)
      startsAt.setDate(now.getDate() + daysUntil)
      const [startHour, startMinute] = session.startTime.split(':').map(Number)
      startsAt.setHours(startHour, startMinute, 0, 0)

      const endsAt = new Date(startsAt)
      const [endHour, endMinute] = session.endTime.split(':').map(Number)
      endsAt.setHours(endHour, endMinute, 0, 0)

      const isInProgress = daysUntil === 0 && startsAt <= now && endsAt > now
      if (daysUntil === 0 && endsAt <= now) {
        daysUntil = 7
        startsAt.setDate(startsAt.getDate() + 7)
      }

      return { ...session, startsAt, isInProgress, daysUntil }
    })
    .filter(Boolean)
    .sort((first, second) => (
      Number(second.isInProgress) - Number(first.isInProgress) || first.startsAt - second.startsAt
    ))[0] || null
}

function TeacherDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [teacherName, setTeacherName] = useState(() => {
    if (typeof window === 'undefined') {
      return 'Teacher'
    }

    try {
      const user = JSON.parse(localStorage.getItem('st-babeth-user') || 'null')
      return user?.fullName?.trim().split(/\s+/)[0] || 'Teacher'
    } catch (storageError) {
      console.warn('Unable to read the teacher name for the dashboard greeting.', storageError)
      return 'Teacher'
    }
  })
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(now)

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      try {
        const user = event.detail || JSON.parse(localStorage.getItem('st-babeth-user') || 'null')
        setTeacherName(user?.fullName?.trim().split(/\s+/)[0] || 'Teacher')
      } catch (storageError) {
        console.warn('Unable to read the teacher name for the dashboard greeting.', storageError)
        setTeacherName('Teacher')
      }
    }

    window.addEventListener('user-profile-updated', handleProfileUpdated)
    const clockInterval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdated)
      window.clearInterval(clockInterval)
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    api.get('/dashboard/teacher')
      .then((response) => {
        const data = response.data?.data
        if (
          !Array.isArray(data?.stats) ||
          !Array.isArray(data.schedule) ||
          !Array.isArray(data.pendingAttendance)
        ) {
          throw new Error('The teacher dashboard returned incomplete data.')
        }

        if (isCurrent) setDashboard(data)
      })
      .catch((apiError) => {
        console.warn('Unable to load teacher dashboard data.', apiError)
        if (isCurrent) {
          setError(apiError.response?.data?.message || 'Your dashboard could not be loaded. Please try again.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [retryCount])

  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now)
  const todaySchedule = dashboard?.schedule.filter((session) => session.day === todayName)
    .sort((first, second) => first.startTime.localeCompare(second.startTime)) || []
  const nextSession = dashboard ? getNextScheduleSession(dashboard.schedule, now) : null
  const attendanceProgress = dashboard?.pendingAttendance?.[0]
    ? Math.min(100, Math.round((dashboard.pendingAttendance[0].marked / Math.max(dashboard.pendingAttendance[0].total, 1)) * 100))
    : 100
  const classesTodayCount = todaySchedule.length
  const nextSessionLabel = nextSession ? `${nextSession.startTime} · ${nextSession.className}` : 'No classes scheduled'

  return (
    <DashboardShell role="teacher" title="Teacher Dashboard" subtitle="Overview">
      <div className="space-y-6">
        <section className="group relative overflow-hidden rounded-[18px] border border-emerald-200/80 bg-[linear-gradient(135deg,_#ffffff_0%,_#ecfdf5_58%,_#f0fdf4_100%)] p-4 text-emerald-950 shadow-[0_14px_34px_rgba(8,28,27,0.07)] transition duration-200 hover:shadow-[0_16px_38px_rgba(8,28,27,0.1)] dark:border-emerald-900/10 dark:bg-[linear-gradient(135deg,_rgba(13,56,52,0.98)_0%,_rgba(11,32,31,0.94)_38%,_rgba(18,45,44,0.95)_100%)] dark:text-white dark:shadow-[0_14px_34px_rgba(8,28,27,0.12)] dark:hover:shadow-[0_16px_38px_rgba(8,28,27,0.14)] sm:p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1),_transparent_34%)]" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-900 dark:text-emerald-100/80">
                St Babeth TSS <span className="mx-2 text-emerald-600 dark:text-emerald-300/70" aria-hidden="true">•</span> Teacher workspace
              </p>
              <h2 className="mt-3 text-[2rem] font-bold tracking-[-0.05em] text-emerald-950 dark:text-white sm:text-[2.3rem]">Welcome back, {teacherName}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700 dark:text-emerald-50/78 sm:text-[0.95rem]">
                Your classes and daily attendance at a glance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/teacher/attendance')}
                className="group/action inline-flex min-h-11 items-center gap-2.5 rounded-xl bg-[#f5d77e] px-4 py-2.5 text-sm font-bold text-[#102828] shadow-[0_10px_22px_rgba(245,215,126,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f8dd9b] hover:shadow-[0_14px_26px_rgba(245,215,126,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d2f2d] active:translate-y-0"
              >
                <ClipboardCheck className="h-4 w-4 transition-transform duration-200 group-hover/action:scale-110" />
                Take attendance
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/action:translate-x-1" />
              </button>
              <span className="inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-emerald-200 bg-white/75 px-3.5 py-2.5 text-sm font-semibold text-emerald-900 backdrop-blur-sm dark:border-white/15 dark:bg-white/5 dark:text-emerald-50/90">
                <CalendarDays className="h-4 w-4 text-amber-700 dark:text-[#f5d77e]" />
                {currentDate}
              </span>
            </div>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" role="status">
            Loading your teaching dashboard…
          </div>
        )}

        {error && (
          <section className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 sm:flex-row sm:items-center sm:justify-between dark:border-rose-500/50 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Dashboard unavailable</h3>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>
            <button type="button" onClick={() => {
              setDashboard(null)
              setError('')
              setLoading(true)
              setRetryCount((count) => count + 1)
            }} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-400/60 dark:bg-slate-900 dark:text-rose-100 dark:hover:bg-slate-800">
              Try again
            </button>
          </section>
        )}

        <section className="teacher-day-schedule rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none sm:p-6" aria-labelledby="teacher-schedule-heading">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Plan your day</p>
              <h3 id="teacher-schedule-heading" className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Today’s schedule</h3>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-right shadow-inner shadow-emerald-100 dark:bg-emerald-950/40 dark:shadow-none">
              <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-200">{classesTodayCount} classes</span>
            </div>
          </div>

          {!dashboard ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" role={loading ? 'status' : 'note'}>
              {loading ? 'Loading today’s schedule…' : 'Today’s schedule is unavailable. Please try again.'}
            </p>
          ) : dashboard.schedule.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              No timetable has been added to your assigned classes yet. Ask an administrator to add class days and times.
            </p>
          ) : nextSession?.day === todayName ? (
            <article className="flex flex-col gap-4 rounded-[22px] border border-emerald-200 bg-[linear-gradient(135deg,_rgba(236,253,245,1),_rgba(240,253,250,1))] p-4 shadow-sm dark:border-emerald-700/80 dark:bg-[linear-gradient(135deg,_rgba(12,48,40,0.95),_rgba(15,36,34,0.95))] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{nextSession.className}</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <Clock3 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                  {nextSession.startTime}–{nextSession.endTime}
                </p>
                {nextSession.room && (
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <MapPin className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    {nextSession.room}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 dark:bg-slate-800 dark:text-emerald-200 dark:ring-emerald-600/40">
                  {nextSession.isInProgress ? 'In progress' : 'Next up'}
                </span>
                <button type="button" onClick={() => navigate(`/teacher/attendance?classId=${encodeURIComponent(nextSession.classId)}`)} className="rounded-xl bg-emerald-700 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
                  Open attendance
                </button>
              </div>
            </article>
          ) : (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-200">
                {todaySchedule.length > 0 ? 'You have finished today’s scheduled classes.' : 'No classes are scheduled today.'}
                {nextSession && <> Your next class is <strong className="font-semibold text-slate-800 dark:text-slate-100">{nextSession.className}</strong> on {nextSession.day} at {nextSession.startTime}.</>}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Next: {nextSessionLabel}</p>
            </div>
          )}
        </section>

        {dashboard && (
          <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Teaching statistics">
          {dashboard.stats.map((stat) => {
            const style = statStyles[stat.tone] || statStyles.blue
            const Icon = style.icon

            return (
              <article
                key={stat.label}
                className="group relative flex min-h-28 items-center gap-4 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none dark:hover:border-emerald-700/60"
              >
                <span className={`dashboard-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.background} ${style.color} shadow-inner dark:shadow-none`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold leading-tight tracking-[-0.05em] text-slate-900 dark:text-slate-100">{stat.value}</p>
                  <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{stat.delta}</p>
                </div>
                <span className={`absolute inset-x-0 bottom-0 h-1 opacity-80 ${style.edge}`} />
              </article>
            )
          })}
        </section>

        <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none sm:p-6" aria-labelledby="attendance-task-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="attendance-task-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">Attendance to complete</h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Your next action for today</p>
            </div>
            {dashboard.pendingAttendance.length === 0 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                All caught up
              </span>
            )}
          </div>
          {dashboard.pendingAttendance.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4 rounded-[22px] bg-[linear-gradient(135deg,_rgba(248,250,252,1),_rgba(236,253,245,1))] p-4 shadow-inner ring-1 ring-slate-200 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(8,47,42,0.92))] dark:ring-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{dashboard.pendingAttendance[0].className}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800 shadow-sm ring-1 ring-emerald-100 dark:bg-slate-800 dark:text-emerald-200 dark:ring-emerald-600/40">
                    {attendanceProgress}% complete
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {dashboard.pendingAttendance[0].marked} of {dashboard.pendingAttendance[0].total} students marked
                  {dashboard.pendingAttendance.length > 1 && ` · ${dashboard.pendingAttendance.length - 1} more ${dashboard.pendingAttendance.length === 2 ? 'class' : 'classes'} need attention`}
                </p>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-300" style={{ width: `${attendanceProgress}%` }} />
                </div>
              </div>
              <button type="button" onClick={() => navigate(`/teacher/attendance?classId=${encodeURIComponent(dashboard.pendingAttendance[0].classId)}`)} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
                Continue attendance
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Attendance is complete for all assigned classes today.</p>
          )}
        </section>
          </>
        )}

      </div>
    </DashboardShell>
  )
}

export default TeacherDashboard
