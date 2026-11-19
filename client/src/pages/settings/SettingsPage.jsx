import { CalendarDays, CheckCircle2, Clock3, ImagePlus, ShieldCheck, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import DashboardShell from '../../components/dashboard/DashboardShell'
import api from '../../services/api'
import { prepareLogoImage } from './logoImage'

const emptySchoolSettings = {
  schoolName: 'St Babeth TSS',
  district: '',
  contactEmail: '',
  aboutText: '',
  logoDataUrl: '',
  academicYear: '',
  academicYearStartDate: '',
  academicYearEndDate: '',
  currentTermName: '',
  currentTermStartDate: '',
  currentTermEndDate: ''
}

const getSettingsErrorMessage = (error, fallbackMessage) => {
  if (error.response?.data?.message) {
    return error.response.data.message
  }

  if (!error.response) {
    return 'Cannot reach the API server. Start the backend and make sure MongoDB is running, then try again.'
  }

  return fallbackMessage
}

function SettingsPage({ role }) {
  const [schoolSettings, setSchoolSettings] = useState(emptySchoolSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const isAdmin = role === 'admin'

  useEffect(() => {
    let isCurrent = true

    const loadSchoolSettings = async () => {
      try {
        const response = await api.get('/settings/school')
        const loadedSettings = { ...emptySchoolSettings, ...response.data.data }
        if (loadedSettings.logoDataUrl) {
          try {
            loadedSettings.logoDataUrl = await prepareLogoImage(loadedSettings.logoDataUrl)
          } catch (error) {
            console.warn('Unable to prepare the saved school logo.', error)
            if (isCurrent) {
              setErrorMessage('The saved logo could not be previewed. Upload the logo image again to remove its white background.')
            }
          }
        }

        if (isCurrent) {
          setSchoolSettings(loadedSettings)
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(getSettingsErrorMessage(error, 'Unable to load school information. Please try again.'))
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    loadSchoolSettings()
    return () => {
      isCurrent = false
    }
  }, [])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setSchoolSettings((current) => ({ ...current, [name]: value }))
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Choose a PNG, JPEG, or WebP logo image.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('The logo image must be smaller than 2 MB.')
      return
    }

    prepareLogoImage(URL.createObjectURL(file), true)
      .then((logoDataUrl) => {
        setSchoolSettings((current) => ({ ...current, logoDataUrl }))
        setErrorMessage('')
        setSuccessMessage('')
      })
      .catch((error) => {
        setErrorMessage(error.message || 'Unable to prepare the selected logo image.')
      })
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await api.put('/settings/school', schoolSettings)
      const savedSettings = { ...emptySchoolSettings, ...response.data.data }
      setSchoolSettings(savedSettings)
      window.dispatchEvent(new CustomEvent('school-settings-updated', { detail: savedSettings }))
      setSuccessMessage('School information saved successfully.')
    } catch (error) {
      setErrorMessage(getSettingsErrorMessage(error, 'Unable to save school information. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  const updateSchoolSettings = (changes) => {
    setSchoolSettings((current) => ({ ...current, ...changes }))
    setErrorMessage('')
    setSuccessMessage('')
  }

  return (
    <DashboardShell
      role={role}
      title="Settings"
      subtitle={role === 'admin' ? 'School administration' : 'Teacher access'}
    >
      <div className="settings-page px-1 py-4 sm:px-4 sm:py-8">
        <form onSubmit={handleSave} className="settings-panel mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <fieldset disabled={isLoading || isSaving || !isAdmin} className="space-y-6">
            <section className="settings-section">
              <h2 className="text-xl font-bold text-slate-900">School Information</h2>
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">School Logo</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 p-1">
                    {schoolSettings.logoDataUrl
                      ? <img src={schoolSettings.logoDataUrl} alt="School logo preview" className="h-full w-full rounded-full object-contain" />
                      : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <ImagePlus className="h-7 w-7" aria-hidden="true" />
                          <span className="text-[10px] font-medium">No logo</span>
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 focus-within:ring-2 focus-within:ring-amber-400">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Change image…
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoChange}
                        className="sr-only"
                        aria-label="Upload school logo"
                      />
                    </label>
                    {schoolSettings.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => updateSchoolSettings({ logoDataUrl: '' })}
                        className="inline-flex items-center gap-1 px-1 py-1 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600">Upload a PNG, JPEG, or WebP image up to 2 MB.</p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  School Name
                  <input
                    name="schoolName"
                    value={schoolSettings.schoolName}
                    onChange={handleFieldChange}
                    required
                    minLength={2}
                    maxLength={120}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  District
                  <input
                    name="district"
                    value={schoolSettings.district}
                    onChange={handleFieldChange}
                    maxLength={120}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Contact Email
                  <input
                    type="email"
                    name="contactEmail"
                    value={schoolSettings.contactEmail}
                    onChange={handleFieldChange}
                    maxLength={254}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  About Text
                  <textarea
                    name="aboutText"
                    value={schoolSettings.aboutText}
                    onChange={handleFieldChange}
                    maxLength={1000}
                    rows={3}
                    className="mt-1.5 block w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">{schoolSettings.aboutText.length}/1,000 characters</span>
                </label>
              </div>
            </section>

            <section className="settings-section" aria-labelledby="academic-calendar-heading">
              <div className="flex items-start gap-3">
                <span className="settings-section-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="academic-calendar-heading" className="text-xl font-bold text-slate-900">Academic Calendar</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Set the current academic year and term dates for your school.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Academic Year
                  <input
                    name="academicYear"
                    value={schoolSettings.academicYear}
                    onChange={handleFieldChange}
                    maxLength={40}
                    placeholder="e.g. 2026–2027"
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Current Term
                  <input
                    name="currentTermName"
                    value={schoolSettings.currentTermName}
                    onChange={handleFieldChange}
                    maxLength={40}
                    placeholder="e.g. Term 1"
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Academic Year Starts
                  <input
                    type="date"
                    name="academicYearStartDate"
                    value={schoolSettings.academicYearStartDate}
                    onChange={handleFieldChange}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Academic Year Ends
                  <input
                    type="date"
                    name="academicYearEndDate"
                    value={schoolSettings.academicYearEndDate}
                    onChange={handleFieldChange}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Term Starts
                  <input
                    type="date"
                    name="currentTermStartDate"
                    value={schoolSettings.currentTermStartDate}
                    onChange={handleFieldChange}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Term Ends
                  <input
                    type="date"
                    name="currentTermEndDate"
                    value={schoolSettings.currentTermEndDate}
                    onChange={handleFieldChange}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-normal text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </section>

            <section className="settings-section" aria-labelledby="attendance-rules-heading">
              <div className="flex items-start gap-3">
                <span className="settings-section-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="attendance-rules-heading" className="text-xl font-bold text-slate-900">Attendance Rules</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Current recording rules used across the attendance register.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="settings-rule-card">
                  <span className="settings-rule-icon"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <h3>One record per student, class, and day</h3>
                    <p>Saving attendance again updates that student’s record for the same day.</p>
                  </div>
                </div>
                <div className="settings-rule-card">
                  <span className="settings-rule-icon"><Clock3 className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <h3>Attendance statuses</h3>
                    <p>Present, Absent, Late, and Excused.</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">These rules are informational and cannot be changed here.</p>
            </section>

          </fieldset>

          {!isAdmin && <p className="border-t border-slate-200 pt-4 text-sm font-medium text-amber-700">Only an administrator can edit school information.</p>}

          {errorMessage && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <div className="mx-auto mt-5 w-full max-w-4xl overflow-hidden rounded-2xl border border-[#cfe2db] bg-[#edf5f2] shadow-[0_1px_0_rgba(20,62,54,0.04)]">
              <div role="status" className="flex items-center gap-3 px-5 py-4 text-base font-medium text-[#143e36] sm:px-6">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dceee8] text-[#17604f]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="submit"
                disabled={isLoading || isSaving}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8891e] bg-[#d6aa36] px-5 py-2.5 text-sm font-bold text-[#142b4a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#e1b946] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Loading settings…' : isSaving ? 'Saving…' : 'Save School Settings'}
              </button>
            </div>
          )}
        </form>

      </div>
    </DashboardShell>
  )
}

export default SettingsPage
