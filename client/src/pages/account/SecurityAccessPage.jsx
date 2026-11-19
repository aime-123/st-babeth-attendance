import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import DashboardShell from '../../components/dashboard/DashboardShell'
import api from '../../services/api'

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

const getErrorMessage = (error) => error.response?.data?.message
  || (!error.response ? 'Cannot reach the API server. Start the backend and try again.' : 'Unable to change your password.')

function SecurityAccessPage({ role }) {
  const [form, setForm] = useState(initialForm)
  const [visibleFields, setVisibleFields] = useState({})
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  const toggleVisibility = (field) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (form.newPassword !== form.confirmPassword) {
      setError('The new password and confirmation do not match.')
      return
    }
    if (form.newPassword.length < 8) {
      setError('Your new password must be at least 8 characters.')
      return
    }

    setSaving(true)
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      })
      localStorage.setItem('st-babeth-token', response.data.data.token)
      localStorage.setItem('st-babeth-user', JSON.stringify(response.data.data.user))
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: response.data.data.user }))
      setForm(initialForm)
      setSuccess('Password changed successfully. Use your new password the next time you sign in.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const passwordFields = [
    { name: 'currentPassword', label: 'Current password', autocomplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autocomplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm new password', autocomplete: 'new-password' }
  ]

  return (
    <DashboardShell role={role} title="Security & Access" subtitle="Account">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Security & access</p>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">Keep your account secure</h2>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-900">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Enter your current password, then choose a new password with at least 8 characters.</p>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}
          {success && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</p>}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {passwordFields.map(({ name, label, autocomplete }) => (
              <label key={name} className="block max-w-xl text-sm font-semibold text-slate-700">
                {label}
                <span className="relative mt-1.5 block">
                  <input
                    type={visibleFields[name] ? 'text' : 'password'}
                    name={name}
                    autoComplete={autocomplete}
                    value={form[name]}
                    onChange={handleChange}
                    required
                    minLength={name === 'currentPassword' ? undefined : 8}
                    className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-12 font-normal text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(name)}
                    aria-label={`${visibleFields[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                  >
                    {visibleFields[name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
            ))}

            <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? 'Updating password…' : 'Change password'}
            </button>
          </form>
        </section>
      </div>
    </DashboardShell>
  )
}

export default SecurityAccessPage
