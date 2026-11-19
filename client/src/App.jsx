import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherTimetablePage from './pages/teacher/TeacherTimetablePage'
import ClassManagementPage from './pages/classes/ClassManagementPage'
import StudentManagementPage from './pages/students/StudentManagementPage'
import TeacherManagementPage from './pages/teachers/TeacherManagementPage'
import TeacherTimetablesPage from './pages/timetables/TeacherTimetablesPage'
import AttendanceManagementPage from './pages/attendance/AttendanceManagementPage'
import AttendanceHistoryPage from './pages/attendance/AttendanceHistoryPage'
import ReportsPage from './pages/reports/ReportsPage'
import SettingsPage from './pages/settings/SettingsPage'
import ProfilePage from './pages/account/ProfilePage'
import SecurityAccessPage from './pages/account/SecurityAccessPage'
import DashboardShell from './components/dashboard/DashboardShell'

const readStoredUser = () => {
  try {
    const rawValue = localStorage.getItem('st-babeth-user')
    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null
  } catch (error) {
    console.warn('Unable to read the stored user profile.', error)
    return null
  }
}

function ProtectedDashboard({ role }) {
  const storedUser = readStoredUser()
  const location = useLocation()

  if (!storedUser || storedUser.role !== role) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

function HomeRedirect() {
  const storedUser = readStoredUser()

  if (!storedUser) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={storedUser.role === 'admin' ? '/admin' : '/teacher'} replace />
}

function DashboardLayout({ role }) {
  const { pathname } = useLocation()
  const page = pathname.slice(`/${role}`.length).replace(/^\//, '')
  const titleByPage = {
    admin: {
      '': ['Admin Dashboard', 'Overview'],
      history: ['Attendance History', 'Administration'],
      reports: ['Reports', 'Administration'],
      settings: ['Settings', 'School administration'],
      classes: ['Class Management', 'Administration'],
      students: ['Student Management', 'Administration'],
      teachers: ['Teacher Management', 'Staff, access & class assignments'],
      timetables: ['Teacher Timetables', 'School management'],
      profile: ['My Profile', 'Account'],
      security: ['Security & Access', 'Account']
    },
    teacher: {
      '': ['Teacher Dashboard', 'Overview'],
      attendance: ['Mark Attendance', 'Teacher'],
      history: ['Attendance Log', 'Teacher'],
      classes: ['My Classes', 'Teacher'],
      timetable: ['My Timetable', 'Teacher'],
      profile: ['My Profile', 'Account'],
      security: ['Security & Access', 'Account']
    }
  }
  const [title, subtitle] = titleByPage[role][page] || titleByPage[role]['']

  return (
    <DashboardShell
      role={role}
      title={title}
      subtitle={subtitle}
    >
      <Outlet />
    </DashboardShell>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedDashboard role="admin" />}>
          <Route element={<DashboardLayout role="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="history" element={<AttendanceHistoryPage role="admin" />} />
            <Route path="reports" element={<ReportsPage role="admin" />} />
            <Route path="settings" element={<SettingsPage role="admin" />} />
            <Route path="profile" element={<ProfilePage role="admin" />} />
            <Route path="security" element={<SecurityAccessPage role="admin" />} />
            <Route path="classes" element={<ClassManagementPage role="admin" />} />
            <Route path="students" element={<StudentManagementPage />} />
            <Route path="teachers" element={<TeacherManagementPage />} />
            <Route path="timetables" element={<TeacherTimetablesPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route path="/teacher" element={<ProtectedDashboard role="teacher" />}>
          <Route element={<DashboardLayout role="teacher" />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="timetable" element={<TeacherTimetablePage />} />
            <Route path="attendance" element={<AttendanceManagementPage role="teacher" />} />
            <Route path="history" element={<AttendanceHistoryPage role="teacher" />} />
            <Route path="profile" element={<ProfilePage role="teacher" />} />
            <Route path="security" element={<SecurityAccessPage role="teacher" />} />
            <Route path="reports" element={<Navigate to="/teacher" replace />} />
            <Route path="settings" element={<Navigate to="/teacher" replace />} />
            <Route path="classes" element={<ClassManagementPage role="teacher" />} />
            <Route path="students" element={<Navigate to="/teacher" replace />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
