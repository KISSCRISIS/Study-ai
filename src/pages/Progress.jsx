import { motion } from 'framer-motion'
import { useProgress } from '../hooks/useProgress'
import { PROGRESS_STATUS, allCardIds } from '../data/appDatabase'

const SECTION_META = [
  { key: 'flashcards',  label: 'البطاقات',          icon: '⚡' },
  { key: 'numericals',  label: 'الأرقام',            icon: '#'  },
  { key: 'examTraps',   label: 'مصائد الامتحان',     icon: '⚠️' },
  { key: 'algorithms',  label: 'الخوارزميات',        icon: '⑂' },
  { key: 'antidotes',   label: 'الترياق',            icon: '💊' },
  { key: 'visualSigns', label: 'العلامات البصرية',   icon: '👁' },
]

function ProgressBar({ value, color = 'teal' }) {
  return (
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full bg-${color}-500 rounded-full`}
      />
    </div>
  )
}

function StatusBadge({ label, count, color }) {
  return (
    <div className={`bg-${color}-900/20 border border-${color}-800/30 rounded-xl px-4 py-3 text-center`}>
      <p className={`text-xl font-bold text-${color}-400`}>{count}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function Progress() {
  const { summary, sectionSummary, resetAll } = useProgress()

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد أنك تريد إعادة تعيين كل التقدم؟')) {
      resetAll()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-3xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">📈 تقدمي</h1>
        <p className="text-sm text-slate-400">تتبع مستوى إتقانك لكل قسم</p>
      </div>

      {/* Overall progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">التقدم الكلي</p>
            <p className="text-4xl font-bold text-teal-400">{summary.percentMastered}%</p>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-teal-500/30 flex items-center justify-center relative">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90 absolute">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0f4c5c" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" stroke="#14b8a6" strokeWidth="3"
                strokeDasharray={`${summary.percentMastered} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-lg font-bold text-teal-400 relative z-10">{summary.percentMastered}%</span>
          </div>
        </div>
        <ProgressBar value={summary.percentMastered} />
        <p className="text-xs text-slate-500 mt-2">
          {summary[PROGRESS_STATUS.MASTERED]} من {summary.total} عنصر تم إتقانه
        </p>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatusBadge label="جديدة" count={summary[PROGRESS_STATUS.NEW]} color="slate" />
        <StatusBadge label="قيد المراجعة" count={summary[PROGRESS_STATUS.LEARNING]} color="yellow" />
        <StatusBadge label="خاطئة" count={summary[PROGRESS_STATUS.WRONG]} color="red" />
        <StatusBadge label="أتقنتها" count={summary[PROGRESS_STATUS.MASTERED]} color="teal" />
      </div>

      {/* Per-section progress */}
      <h2 className="text-sm font-semibold text-slate-400 mb-3">التقدم حسب القسم</h2>
      <div className="space-y-3 mb-8">
        {SECTION_META.map(sec => {
          const ids = allCardIds[sec.key] || []
          const secSummary = sectionSummary(ids)
          const mastered = secSummary[PROGRESS_STATUS.MASTERED] || 0
          const pct = ids.length > 0 ? Math.round((mastered / ids.length) * 100) : 0

          return (
            <div key={sec.key} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{sec.icon}</span>
                  <span className="text-sm text-slate-300">{sec.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{mastered}/{ids.length}</span>
                  <span className="text-sm font-bold text-teal-400">{pct}%</span>
                </div>
              </div>
              <ProgressBar value={pct} />
            </div>
          )
        })}
      </div>

      {/* Reset button */}
      <div className="border-t border-slate-800 pt-6">
        <p className="text-xs text-slate-500 mb-3">
          يتم حفظ التقدم تلقائياً في المتصفح عبر localStorage.
        </p>
        <button
          onClick={handleReset}
          className="px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 rounded-xl text-sm transition-colors"
        >
          🔄 إعادة تعيين كل التقدم
        </button>
      </div>
    </motion.div>
  )
}
