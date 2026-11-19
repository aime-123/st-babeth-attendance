import { useEffect, useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import DashboardShell from '../../components/dashboard/DashboardShell'

const fallbackData = {
  stats: [
    { label: 'Total Students', value: '1,284', delta: '+8.4%', tone: 'blue' },
    { label: 'Present Today', value: '1,118', delta: '+5.1%', tone: 'green' },
    { label: 'Absent Today', value: '42', delta: '-2.3%', tone: 'amber' },
    { label: 'Total Classes', value: '24', delta: 'On track', tone: 'red' }
  ],
  attendanceTrend: [
    { name: 'Mon', present: 340, absent: 36 },
    { name: 'Tue', present: 386, absent: 31 },
    { name: 'Wed', present: 378, absent: 38 },
    { name: 'Thu', present: 368, absent: 34 },
    { name: 'Fri', present: 405, absent: 37 },
    { name: 'Sat', present: 420, absent: 41 },
    { name: 'Sun', present: 398, absent: 39 }
  ],
  classes: [
    { name: 'Form 1A', teacher: 'Ms. A. Mugisha', attendance: '95%', students: '42/43' },
    { name: 'Form 2B', teacher: 'Mr. H. Kamanzi', attendance: '92%', students: '40/41' },
    { name: 'Form 3C', teacher: 'Mrs. R. Ndayisaba', attendance: '89%', students: '38/39' },
    { name: 'Form 4D', teacher: 'Mr. S. Habimana', attendance: '94%', students: '41/42' }
  ],
  activities: [
    { title: 'Attendance submitted', description: 'Attendance was updated for Form 1A.', time: '2 minutes ago' },
    { title: 'New student registered', description: 'Uwimana Jean was added to the student list.', time: '10 minutes ago' },
    { title: 'Class updated', description: 'S3 Science class details were updated.', time: '25 minutes ago' },
    { title: 'New teacher added', description: 'Mukamana Florence joined the school.', time: '1 hour ago' },
    { title: 'Report generated', description: 'The daily attendance report is ready.', time: '1 hour ago' }
  ]
}

const statStyles = {
  blue: { icon: Users, color: 'text-blue-700', background: 'bg-blue-50', edge: 'bg-blue-500' },
  green: { icon: CalendarDays, color: 'text-emerald-700', background: 'bg-emerald-50', edge: 'bg-emerald-500' },
  amber: { icon: UserRound, color: 'text-amber-700', background: 'bg-amber-50', edge: 'bg-amber-500' },
  red: { icon: ClipboardCheck, color: 'text-rose-700', background: 'bg-rose-50', edge: 'bg-rose-500' }
}

function getActivityIcon(title = '') {
  const activity = title.toLowerCase()
  if (activity.includes('attendance') || activity.includes('submitted')) return CheckCircle2
  if (activity.includes('student') || activity.includes('teacher')) return UserRound
  return CalendarDays
}

function getActivityCategory(activity = {}) {
  const content = `${activity.title || ''} ${activity.description || ''}`.toLowerCase()
  return content.includes('attendance') || content.includes('absent') ? 'attendance' : 'updates'
}

function getClassCounts(students = '') {
  const [present, total] = String(students).match(/\d+/g) || []
  const presentCount = Number(present) || 0
  const totalCount = Number(total) || 0

  return {
    present: presentCount,
    absent: Math.max(totalCount - presentCount, 0),
    total: totalCount
  }
}

function getStatus(attendance = '') {
  const rate = Number.parseFloat(attendance)
  if (rate >= 95) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700' }
  if (rate >= 90) return { label: 'Very Good', color: 'bg-green-100 text-green-700' }
  return { label: 'Good', color: 'bg-blue-100 text-blue-700' }
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(fallbackData)
  const [loading, setLoading] = useState(true)
  const [visibleSeries, setVisibleSeries] = useState({ present: true, absent: true })
  const [activityFilter, setActivityFilter] = useState('all')
  const [currentDate] = useState(() => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date()))

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard/admin')
        const dashboardData = response.data?.data
        if (
          Array.isArray(dashboardData?.stats) &&
          Array.isArray(dashboardData.attendanceTrend) &&
          Array.isArray(dashboardData.classes) &&
          Array.isArray(dashboardData.activities)
        ) {
          setDashboard(dashboardData)
        } else {
          console.warn('Received incomplete admin dashboard data; keeping fallback data.')
        }
      } catch (error) {
        console.warn('Falling back to local admin dashboard data.', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const displayData = loading ? fallbackData : dashboard
  const activities = displayData.activities
    .filter((activity) => activityFilter === 'all' || getActivityCategory(activity) === activityFilter)
    .slice(0, 5)

  const toggleSeries = (series) => {
    setVisibleSeries((current) => ({ ...current, [series]: !current[series] }))
  }

  return (
    <DashboardShell role="admin" title="Admin Dashboard" subtitle="Overview">
      <div className="space-y-6">
        <section className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md sm:p-7">
          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">St Babeth TSS <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span> School overview</p>
            <h2 className="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">Welcome, Administrator</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Your school’s attendance and class activity at a glance.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/history')}
                className="group/action inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:translate-y-0"
              >
                <ClipboardCheck className="h-4 w-4 transition-transform duration-200 group-hover/action:scale-110" />
                View attendance history
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/action:translate-x-1" />
              </button>
              <span className="inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4 text-emerald-700" />
                {currentDate}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="School statistics">
          {displayData.stats.map((stat) => {
            const style = statStyles[stat.tone] || statStyles.blue
            const Icon = style.icon
            const isDown = stat.delta?.startsWith('-')
            const destination = stat.label.toLowerCase().includes('student')
              ? '/admin/reports'
              : stat.label.toLowerCase().includes('class')
                ? '/admin/classes'
                : '/admin/history'

            return (
              <article
                key={stat.label}
                className="group relative flex min-h-28 items-center gap-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
              >
                <button
                  type="button"
                  aria-label={`Open ${stat.label}`}
                  onClick={() => navigate(destination)}
                  className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none"
                >
                  <span className="sr-only">Open {stat.label}</span>
                </button>
                <span className={`dashboard-stat-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.background} ${style.color}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-900">{stat.value}</p>
                  <p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${isDown ? 'text-rose-700' : stat.delta?.startsWith('+') ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {isDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : stat.delta?.startsWith('+') ? <ArrowUpRight className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {stat.delta}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true" />
                <span className={`absolute inset-x-0 bottom-0 h-0.5 opacity-70 ${style.edge}`} />
              </article>
            )
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Attendance overview</h3>
                <p className="mt-1 text-xs text-slate-500">Daily student attendance over the last week</p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Last 7 days</span>
            </div>
            <div className="mb-2 flex items-center gap-4 text-xs font-medium text-slate-600">
              <button
                type="button"
                aria-pressed={visibleSeries.present}
                onClick={() => toggleSeries('present')}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${visibleSeries.present ? '' : 'opacity-45'}`}
              >
                <i className="h-2.5 w-2.5 rounded-full bg-blue-600" />Present
              </button>
              <button
                type="button"
                aria-pressed={visibleSeries.absent}
                onClick={() => toggleSeries('absent')}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${visibleSeries.absent ? '' : 'opacity-45'}`}
              >
                <i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Absent
              </button>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayData.attendanceTrend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={5}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f5f8fc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15, 23, 42, .08)' }} />
                  {visibleSeries.present && <Bar dataKey="present" name="Present" fill="#0968d8" radius={[4, 4, 0, 0]} maxBarSize={26} />}
                  {visibleSeries.absent && <Bar dataKey="absent" name="Absent" fill="#ff8a00" radius={[4, 4, 0, 0]} maxBarSize={26} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Recent activity</h3>
                <p className="mt-1 text-xs text-slate-500">Latest updates across your school</p>
              </div>
              <button type="button" onClick={() => navigate('/admin/history')} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mb-1 flex gap-1" role="group" aria-label="Filter recent activities">
              {[
                { label: 'All', value: 'all' },
                { label: 'Attendance', value: 'attendance' },
                { label: 'Updates', value: 'updates' }
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={activityFilter === value}
                  onClick={() => setActivityFilter(value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    activityFilter === value ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              {activities.map((activity, index) => {
                const Icon = getActivityIcon(activity.title)
                return (
                  <div key={`${activity.title}-${index}`} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{activity.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{activity.description}</p>
                    </div>
                    <time className="shrink-0 pt-0.5 text-[11px] text-slate-400">{activity.time}</time>
                  </div>
                )
              })}
              {activities.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No {activityFilter === 'all' ? 'recent activity' : `${activityFilter} activity`} to show.</p>}
            </div>
          </article>
        </section>

        <section>
          <article className="overflow-hidden rounded-[18px] border border-[#0f574d] bg-[#0b3b35] shadow-[0_10px_24px_rgba(6,35,29,0.12)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#0f574d] bg-[#0b3b35] px-3 py-3 sm:px-4">
              <div>
                <h3 className="text-[16px] font-bold tracking-tight text-[#eafaf6]">Class performance</h3>
                <p className="mt-0.5 text-[11px] text-[#cfe2dd]">Attendance summary by class</p>
              </div>
              <button type="button" onClick={() => navigate('/admin/classes')} className="inline-flex min-h-8 items-center justify-center rounded-lg bg-[#0f6b5d] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_3px_8px_rgba(15,107,93,0.2)] transition hover:bg-[#0d5b4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7e7df] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b3b35]">View classes</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-[12px]">
                <thead className="bg-[#0b3b35] text-[#dfe9e5]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">#</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Class</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Students</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Present</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Absent</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Rate</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.18em] text-[#edf6f3]">Status</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {displayData.classes.slice(0, 5).map((schoolClass, index) => {
                    const counts = getClassCounts(schoolClass.students)
                    const status = getStatus(schoolClass.attendance)
                    const attendanceValue = Math.min(Number.parseFloat(schoolClass.attendance) || 0, 100)
                    const isExcellent = attendanceValue >= 90
                    const isGood = attendanceValue >= 70
                    return (
                      <tr key={schoolClass.name} className="border-t border-[#1b574e] bg-[#0b3b35] transition hover:bg-[#0d473f]">
                        <td className="px-3 py-2.5 text-[13px] font-medium text-[#f4f8f6]">{index + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold leading-tight text-white">{schoolClass.name}</span>
                            <span className="mt-1 text-[10px] text-[#d0ddd7]">{schoolClass.teacher}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] font-medium text-[#f4f8f6]">{counts.total || schoolClass.students}</td>
                        <td className="px-3 py-2.5 text-[13px] font-medium text-[#e3f8ef]">{counts.present || '—'}</td>
                        <td className="px-3 py-2.5 text-[13px] font-medium text-[#e3f8ef]">{counts.total ? counts.absent : '—'}</td>
                        <td className="min-w-[120px] px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-9 shrink-0 text-right text-[11px] font-bold text-[#f4f8f6]">{schoolClass.attendance}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#d9efe7]/20">
                              <span className={`block h-full rounded-full ${isExcellent || isGood ? 'bg-[#5ee7c3]' : 'bg-[#f4c663]'}`} style={{ width: `${attendanceValue}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex min-w-[76px] items-center justify-center rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${status.label === 'Excellent' ? 'border-[#27816f] bg-[#174f45] text-[#a6f4d8]' : status.label === 'Very Good' ? 'border-[#27816f] bg-[#174f45] text-[#a6f4d8]' : 'border-[#2a7564] bg-[#16483f] text-[#c5eadc]'}`}>
                            {status.label === 'Excellent' ? 'Very good' : status.label === 'Very Good' ? 'Very good' : 'Good'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {displayData.classes.length === 0 && (
                    <tr><td colSpan="7" className="px-3 py-5 text-center text-xs text-[#dfe9e5]">No classes have been added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </DashboardShell>
  )
}

export default AdminDashboard
