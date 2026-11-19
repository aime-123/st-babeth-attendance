import { ArrowUpRight, TrendingUp } from 'lucide-react'

function StatCard({ label, value, delta, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700'
  }

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <TrendingUp className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <h3 className="text-3xl font-bold tracking-tight text-slate-900">{value}</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {delta}
        </span>
      </div>
    </div>
  )
}

export default StatCard
