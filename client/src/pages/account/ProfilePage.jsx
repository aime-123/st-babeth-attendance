import { useEffect, useState } from 'react'
import { CheckCircle2, Upload, UserRound, X } from 'lucide-react'
import DashboardShell from '../../components/dashboard/DashboardShell'
import api from '../../services/api'

const getErrorMessage = (error, fallback) => error.response?.data?.message
  || (!error.response ? 'Cannot reach the API server. Start the backend and try again.' : fallback)

function ProfilePage({ role }) {
  const [profile, setProfile] = useState({ fullName: '', email: '', username: '', phone: '', profileImage: '', role, status: '' })
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isCurrent = true

    api.get('/auth/me')
      .then((response) => {
        if (isCurrent) setProfile(response.data.data)
      })
      .catch((requestError) => {
        if (isCurrent) setError(getErrorMessage(requestError, 'Unable to load your profile.'))
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP profile image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile images must be smaller than 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read the selected profile image.')
        return
      }

      setProfile((current) => ({ ...current, profileImage: reader.result }))
      setError('')
      setSuccess('')
    }
    reader.onerror = () => setError('Unable to read the selected profile image.')
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await api.patch('/auth/me', {
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        profileImage: profile.profileImage || ''
      })
      const updatedProfile = response.data.data
      setProfile((current) => ({ ...current, ...updatedProfile }))
      localStorage.setItem('st-babeth-user', JSON.stringify(updatedProfile))
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updatedProfile }))
      setSuccess('Your profile was updated successfully.')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to update your profile.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role={role} title="My Profile" subtitle="Account">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-200 bg-emerald-100 text-emerald-800">
              {profile.profileImage
                ? <img src={profile.profileImage} alt="Profile preview" className="h-full w-full object-cover" />
                : <UserRound className="h-7 w-7" aria-hidden="true" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Account profile</p>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">Your personal information</h2>
            </div>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
          {success && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />{success}</p>}

          {isLoading ? (
            <p className="py-8 text-center text-sm font-medium text-slate-600">Loading your profile…</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-100 text-emerald-800 shadow-sm">
                  {profile.profileImage
                    ? <img src={profile.profileImage} alt="Profile image preview" className="h-full w-full object-cover" />
                    : <UserRound className="h-8 w-8" aria-hidden="true" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Profile photo</p>
                  <p className="mt-1 text-xs text-slate-600">PNG, JPEG, or WebP. Maximum file size: 2 MB.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-400 hover:bg-emerald-50 focus-within:ring-2 focus-within:ring-emerald-600">
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Upload photo
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} disabled={isSaving} className="sr-only" aria-label="Upload profile photo" />
                    </label>
                    {profile.profileImage && (
                      <button type="button" onClick={() => {
                        setProfile((current) => ({ ...current, profileImage: '' }))
                        setError('')
                        setSuccess('')
                      }} disabled={isSaving} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60">
                        <X className="h-4 w-4" aria-hidden="true" />
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                  <input name="fullName" value={profile.fullName || ''} onChange={handleChange} required minLength={2} maxLength={120} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Email address
                  <input name="email" type="email" value={profile.email || ''} onChange={handleChange} required maxLength={254} autoComplete="email" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Phone number
                  <input name="phone" type="tel" value={profile.phone || ''} onChange={handleChange} maxLength={30} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" placeholder="Add a contact number" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm font-semibold text-slate-700">
                    Role
                    <p className="mt-1.5 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 font-medium capitalize text-slate-700">{profile.role || role}</p>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    Account status
                    <p className="mt-1.5 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 font-medium capitalize text-slate-700">{profile.status || '—'}</p>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? 'Saving profile…' : 'Save profile'}
              </button>
            </form>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}

export default ProfilePage
