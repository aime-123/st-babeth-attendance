import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Moon,
  School,
  ShieldCheck,
  Sun
} from 'lucide-react'
import api from '../../services/api'
import { prepareLogoImage } from '../settings/logoImage'
import { getPostLoginPath } from './loginRedirect'

const initialForm = {
  email: '',
  password: ''
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const requestedLocation = location.state?.from
  const [isDarkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return localStorage.getItem('st-babeth-theme') === 'dark'
    } catch (error) {
      console.warn('Unable to read the saved color mode on the login page.', error)
      return false
    }
  })
  const [schoolSettings, setSchoolSettings] = useState({
    schoolName: 'St Babeth TSS',
    district: '',
    contactEmail: '',
    aboutText: '',
    logoDataUrl: ''
  })
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)

    try {
      localStorage.setItem('st-babeth-theme', isDarkMode ? 'dark' : 'light')
    } catch (storageError) {
      console.warn('Unable to save the selected color mode on the login page.', storageError)
    }
  }, [isDarkMode])

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('st-babeth-user') || 'null')

      if (storedUser?.role === 'admin' || storedUser?.role === 'teacher') {
        navigate(getPostLoginPath(storedUser.role, requestedLocation), { replace: true })
      }
    } catch (loginError) {
      console.warn('Unable to read the stored user profile for login redirect.', loginError)
    }
  }, [navigate, requestedLocation])

  useEffect(() => {
    let isCurrent = true

    api.get('/settings/school')
      .then(async (response) => {
        const settings = { ...response.data.data }
        if (settings.logoDataUrl) {
          try {
            settings.logoDataUrl = await prepareLogoImage(settings.logoDataUrl)
          } catch (error) {
            console.warn('Unable to prepare the school logo for the sign-in page.', error)
            settings.logoDataUrl = ''
          }
        }

        if (isCurrent) {
          setSchoolSettings((current) => ({ ...current, ...settings }))
        }
      })
      .catch((error) => {
        console.warn('Unable to load school information for the login page.', error)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/auth/login', form)
      const { token, user } = response.data.data

      localStorage.setItem('st-babeth-token', token)
      localStorage.setItem('st-babeth-user', JSON.stringify(user))

      navigate(getPostLoginPath(user.role, requestedLocation))
    } catch (apiError) {
      const message = apiError.response?.data?.message || (
        apiError.response
          ? 'We could not sign you in. Check your details and try again.'
          : 'Unable to reach the sign-in service. Check your connection and try again.'
      )
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f5f7] px-3 py-5 sm:px-6 sm:py-8 lg:py-10">
      <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-emerald-100/70 blur-3xl" aria-hidden="true" />

      <div className="login-card relative grid w-full max-w-[1160px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_30px_90px_-40px_rgba(15,35,65,0.35)] md:min-h-[700px] md:grid-cols-[1.06fr_0.94fr]">
        <section className="login-hero relative hidden min-h-[700px] overflow-hidden bg-[#102e50] text-white md:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0c2747]/95 via-[#123c5b]/75 to-emerald-900/65" />
          <div className="login-hero-orbit" aria-hidden="true" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 lg:p-12 xl:p-14">
            <div className="flex items-center gap-3">
              <span className="login-logo-badge flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                {schoolSettings.logoDataUrl
                  ? <img src={schoolSettings.logoDataUrl} alt="" className="h-full w-full object-contain p-1" />
                  : <School className="h-6 w-6 text-amber-300" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-wide">{schoolSettings.schoolName}</p>
                <p className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-blue-100/80">SCHOOL ATTENDANCE PORTAL</p>
              </div>
            </div>

            <div className="max-w-lg py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-50 shadow-sm backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                School operations, made simple
              </span>
              <div className="login-hero-copy-card mt-5 rounded-3xl border border-white/15 bg-white/[0.07] p-5 shadow-lg backdrop-blur sm:p-6">
                <h1 className="text-[2.55rem] font-semibold leading-[1.13] tracking-[-0.045em] lg:text-[3.2rem]">
                  One trusted place for a <span className="text-amber-300">smoother school day.</span>
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-blue-50/85 lg:text-[15px]">
                  Bring attendance, class records, and reporting together in a secure workspace designed for your school.
                </p>
                {schoolSettings.aboutText && (
                  <p className="mt-4 max-w-md text-sm leading-6 text-blue-50/75">{schoolSettings.aboutText}</p>
                )}
                {schoolSettings.district && (
                  <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/85">
                    <School className="h-4 w-4 text-amber-300" />
                    {schoolSettings.district}
                  </p>
                )}
              </div>
              <div className="login-feature-grid mt-8 grid max-w-md grid-cols-3 gap-2.5">
                {[
                  { label: 'Attendance', detail: 'Daily registers', icon: ClipboardCheck },
                  { label: 'Class records', detail: 'Classes & learners', icon: GraduationCap },
                  { label: 'School reports', detail: 'Clear insights', icon: BarChart3 }
                ].map(({ label, detail, icon: Icon }) => (
                  <div key={label} className="login-feature-card rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                    <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.08] text-amber-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="text-[11px] font-semibold text-white/95">{label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-blue-100/65">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-blue-100/75">
              <span>{schoolSettings.schoolName} · Attendance Management System</span>
            </div>
          </div>
        </section>

        <section className="login-form-panel flex flex-col justify-center px-5 py-7 sm:px-10 sm:py-12 lg:px-12 xl:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-3 md:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <span className="login-logo-badge flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#102e50] text-white shadow-sm">
                {schoolSettings.logoDataUrl
                  ? <img src={schoolSettings.logoDataUrl} alt="" className="h-full w-full object-contain p-1" />
                  : <School className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{schoolSettings.schoolName}</p>
                  <p className="text-xs text-slate-500">School attendance portal</p>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-label="Secure sign-in" />
            </div>

            <div className="mb-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <span className="login-lock-icon inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4f2] text-[#17604f] ring-1 ring-[#dcebe6]">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  onClick={() => setDarkMode((previous) => !previous)}
                  className={`login-theme-toggle group inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 ${
                    isDarkMode
                      ? 'border-[#34705f] bg-[#104437] text-[#f3bd3b] hover:border-[#f3bd3b] hover:bg-[#155342] focus-visible:ring-amber-400'
                      : 'border-slate-200 bg-white text-[#142b4a] hover:border-emerald-500 hover:bg-emerald-50 focus-visible:ring-emerald-600'
                  }`}
                  aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-checked={isDarkMode}
                  role="switch"
                  title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDarkMode
                    ? <Moon className="h-5 w-5 transition-transform duration-200 group-hover:-rotate-12" strokeWidth={2} aria-hidden="true" />
                    : <Sun className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45" strokeWidth={2} aria-hidden="true" />}
                </button>
              </div>
              <p className="login-eyebrow text-[11px] font-bold uppercase tracking-[0.19em] text-emerald-800">Secure school sign-in</p>
              <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">Sign in to your account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Enter your school email or username and password to access attendance, classes, and reports.</p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100">
                  <span className="text-xs font-bold" aria-hidden="true">!</span>
                </span>
                <p>{error}</p>
              </div>
            )}

            <form className="space-y-[18px]" onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="email" className="mb-2 block text-[13px] font-semibold text-slate-800">Email address or username</label>
                <div className="login-input-shell group flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-[#f8fafb] px-3.5 transition focus-within:border-[#3d806e] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e5f1ed]">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-focus-within:text-[#17604f]" aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="text"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    className="login-input w-full border-0 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="you@school.edu"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Password</label>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    Protected sign-in
                  </span>
                </div>
                <div className="login-input-shell group flex min-h-[52px] items-center gap-3 rounded-xl border border-slate-200 bg-[#f8fafb] px-3.5 transition focus-within:border-[#3d806e] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e5f1ed]">
                  <KeyRound className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-focus-within:text-[#17604f]" aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    className="login-input w-full border-0 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="login-password-toggle inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d806e]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                      : <Eye className="h-4 w-4" aria-hidden="true" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                {capsLockOn && (
                  <p className="login-caps-lock mt-2 text-xs font-medium text-amber-700" role="status">
                    Caps Lock is on
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="login-submit group flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#143e36] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(18,59,103,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#0e3156] hover:shadow-[0_12px_24px_rgba(18,59,103,0.27)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#dcebe6] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Signing you in...</>
                  : <>Sign in<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></>}
              </button>
            </form>

            <aside className="login-support-card mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5" aria-labelledby="login-support-heading">
              <span className="login-support-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#17604f] shadow-sm" aria-hidden="true">
                <Mail className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 id="login-support-heading" className="text-sm font-bold text-slate-800">Need help signing in?</h3>
                {schoolSettings.contactEmail
                  ? <>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Contact your school support team for help with your account.</p>
                    <a className="mt-1 inline-block break-all text-xs font-semibold text-[#17604f] underline decoration-[#17604f]/30 underline-offset-2 transition hover:decoration-[#17604f] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d806e]" href={`mailto:${schoolSettings.contactEmail}`}>
                      {schoolSettings.contactEmail}
                    </a>
                  </>
                  : <p className="mt-1 text-xs leading-5 text-slate-600">Please contact your school administrator for account support.</p>}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
