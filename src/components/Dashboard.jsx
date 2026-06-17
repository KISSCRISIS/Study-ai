import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap, Hash, AlertTriangle, GitBranch,
  Pill, Eye, BookOpen, TrendingUp,
  Award, Clock, ChevronLeft, Flame, Database
} from 'lucide-react'
import {
  appStats,
  specialties,
  highYieldFlashcards,
  PROGRESS_STATUS,
} from '../data/appDatabase'
import { useProgress } from '../hooks/useProgress'

// ─── Animation helper ────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.4, ease: 'easeOut', delay },
})

// ─── Section navigation cards ────────────────────────────────────
const SECTION_CARDS = [
  {
    to: '/flashcards',
    icon: Zap,
    label: 'البطاقات التعليمية',
    sublabel: 'Flashcards',
    count: appStats.flashcards,
    unit: 'بطاقة',
    gradient: 'from-teal-600/20 to-teal-900/10',
    border: 'border-teal-700/30 hover:border-teal-500/50',
    iconCls: 'text-teal-400',
    iconBg: 'bg-teal-600/10',
  },
  {
    to: '/traps',
    icon: AlertTriangle,
    label: 'مصائد الامتحان',
    sublabel: 'Exam Traps',
    count: appStats.examTraps,
    unit: 'فخ',
    gradient: 'from-red-600/15 to-red-900/10',
    border: 'border-red-700/30 hover:border-red-500/50',
    iconCls: 'text-red-400',
    iconBg: 'bg-red-600/10',
  },
  {
    to: '/numericals',
    icon: Hash,
    label: 'الأرقام والجرعات',
    sublabel: 'Numericals',
    count: appStats.numericals,
    unit: 'رقم',
    gradient: 'from-amber-600/15 to-amber-900/10',
    border: 'border-amber-700/30 hover:border-amber-500/50',
    iconCls: 'text-amber-400',
    iconBg: 'bg-amber-600/10',
  },
  {
    to: '/algorithms',
    icon: GitBranch,
    label: 'الخوارزميات',
    sublabel: 'Algorithms',
    count: appStats.algorithms,
    unit: 'خوارزمية',
    gradient: 'from-violet-600/15 to-violet-900/10',
    border: 'border-violet-700/30 hover:border-violet-500/50',
    iconCls: 'text-violet-400',
    iconBg: 'bg-violet-600/10',
  },
  {
    to: '/antidotes',
    icon: Pill,
    label: 'جدول الترياق',
    sublabel: 'Antidotes',
    count: appStats.antidotes,
    unit: 'ترياق',
    gradient: 'from-emerald-600/15 to-emerald-900/10',
    border: 'border-emerald-700/30 hover:border-emerald-500/50',
    iconCls: 'text-emerald-400',
    iconBg: 'bg-emerald-600/10',
  },
  {
    to: '/visual-signs',
    icon: Eye,
    label: 'العلامات البصرية',
    sublabel: 'Visual Signs',
    count: appStats.visualSigns,
    unit: 'علامة',
    gradient: 'from-sky-600/15 to-sky-900/10',
    border: 'border-sky-700/30 hover:border-sky-500/50',
    iconCls: 'text-sky-400',
    iconBg: 'bg-sky-600/10',
  },
  {
    to: '/topics',
    icon: BookOpen,
    label: 'المواضيع',
    sublabel: 'Topics',
    count: appStats.totalTopics,
    unit: 'موضوع',
    gradient: 'from-slate-700/20 to-slate-900/10',
    border: 'border-slate-700/30 hover:border-slate-500/50',
    iconCls: 'text-slate-400',
    iconBg: 'bg-slate-700/20',
  },
  {
    to: '/progress',
    icon: TrendingUp,
    label: 'تقدمي',
    sublabel: 'My Progress',
    count: null,
    unit: '',
    gradient: 'from-pink-600/15 to-pink-900/10',
    border: 'border-pink-700/30 hover:border-pink-500/50',
    iconCls: 'text-pink-400',
    iconBg: 'bg-pink-600/10',
  },
]

// ─── Progress ring ────────────────────────────────────────────────
function ProgressRing({ percent, size = 88, strokeWidth = 8 }) {
  const r    = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  const cx   = size / 2

  const color =
    percent >= 80 ? '#10b981' :
    percent >= 50 ? '#14b8a6' :
    percent >= 25 ? '#f59e0b' : '#64748b'

  return (
    <svg width={size} height={size} aria-label={`${percent}% مُتقَن`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgb(30 41 59)" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1.2s ease' }}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="17"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        {percent}%
      </text>
    </svg>
  )
}

// ─── Status badge pill ────────────────────────────────────────────
function StatusPill({ status, count }) {
  const MAP = {
    [PROGRESS_STATUS.NEW]:      { cls: 'badge-new',      label: 'جديد'   },
    [PROGRESS_STATUS.LEARNING]: { cls: 'badge-learning', label: 'يُراجَع'},
    [PROGRESS_STATUS.WRONG]:    { cls: 'badge-wrong',    label: 'خطأ'    },
    [PROGRESS_STATUS.MASTERED]: { cls: 'badge-mastered', label: 'أتقنت'  },
  }
  const { cls, label } = MAP[status] ?? { cls: 'badge-new', label: status }
  return (
    <span className={cls}>
      <span className="font-mono-num">{count.toLocaleString('ar-EG')}</span> {label}
    </span>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const { summary, lastStudy } = useProgress()

  // 3 random high-yield cards — stable per session
  const previewCards = useMemo(() => {
    const shuffled = [...highYieldFlashcards].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, [])

  // Top specialties for the tag cloud
  const topSpecialties = useMemo(() => specialties.slice(0, 6), [])

  // Source bar chart max
  const sourceMax = useMemo(
    () => Math.max(...Object.values(appStats.sourceCounts)),
    []
  )

  return (
    <div className="space-y-8">

      {/* ── HERO BANNER ───────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0)}
        className="relative overflow-hidden rounded-2xl
                   bg-gradient-to-bl from-teal-900/40 via-slate-900 to-slate-900
                   border border-teal-800/30 p-6 glow-teal"
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full bg-teal-600/5" />
        <div className="pointer-events-none absolute -bottom-10 right-24 w-40 h-40 rounded-full bg-emerald-500/5" />

        <div className="relative flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {/* text side */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className="text-amber-400 animate-pulse-slow" />
              <span className="text-xs text-amber-400 font-semibold tracking-wide uppercase">
                Emergency Medicine Board Prep
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-gradient-teal leading-tight mb-2">
              دليل الصحة الذكي
            </h2>

            <p className="text-sm text-slate-400 leading-relaxed max-w-md mb-4">
              قاعدة بيانات شاملة مستخلصة من
              {' '}<span className="text-slate-300 font-medium">Rosen</span>،
              {' '}<span className="text-slate-300 font-medium">Tintinalli</span>،
              {' '}<span className="text-slate-300 font-medium">HIPPO</span> و
              {' '}<span className="text-slate-300 font-medium">FRCEM</span>
              {' '}للتحضير لامتحانات طب الطوارئ.
            </p>

            <div className="flex flex-wrap gap-2">
              <StatusPill status={PROGRESS_STATUS.MASTERED} count={summary[PROGRESS_STATUS.MASTERED]} />
              <StatusPill status={PROGRESS_STATUS.LEARNING} count={summary[PROGRESS_STATUS.LEARNING]} />
              <StatusPill status={PROGRESS_STATUS.WRONG}    count={summary[PROGRESS_STATUS.WRONG]}    />
              <StatusPill status={PROGRESS_STATUS.NEW}      count={summary[PROGRESS_STATUS.NEW]}      />
            </div>
          </div>

          {/* ring side */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <ProgressRing percent={summary.percentMastered} />
            <span className="text-xs text-slate-500">نسبة الإتقان</span>
          </div>
        </div>

        {/* last study bar */}
        {lastStudy && (
          <div className="relative mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} />
            <span>آخر مراجعة:</span>
            <span className="text-slate-400">{lastStudy.section}</span>
            <span>·</span>
            <span>
              {new Date(lastStudy.timestamp).toLocaleString('ar-EG', {
                day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </motion.div>

      {/* ── STATS GRID ────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.05)}>
        <h3 className="section-heading mb-3 flex items-center gap-2">
          <Database size={17} className="text-teal-400" />
          إحصائيات قاعدة البيانات
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي المواضيع',      value: appStats.totalTopics         },
            { label: 'البطاقات التعليمية',    value: appStats.flashcards          },
            { label: 'مصائد الامتحان',        value: appStats.examTraps           },
            { label: 'الكلمات المفتاحية',     value: appStats.keywords            },
            { label: 'الأرقام والجرعات',      value: appStats.numericals          },
            { label: 'الخوارزميات',           value: appStats.algorithms          },
            { label: 'العلامات البصرية',      value: appStats.visualSigns         },
            { label: 'شرح المنتور بالعربي',   value: appStats.arabicExplanations  },
          ].map(({ label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.04 }}
              className="stat-card"
            >
              <p className="text-2xl font-bold font-mono-num text-gradient-teal">
                {value.toLocaleString('ar-EG')}
              </p>
              <p className="text-xs text-slate-400 leading-snug">{label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── SECTION CARDS ─────────────────────────────────────── */}
      <motion.div {...fadeUp(0.1)}>
        <h3 className="section-heading mb-3">أقسام التطبيق</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SECTION_CARDS.map(({ to, icon: Icon, label, sublabel, count, unit, gradient, border, iconCls, iconBg }, i) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.04 }}
            >
              <NavLink
                to={to}
                className={`block bg-gradient-to-br ${gradient} border ${border}
                            rounded-2xl p-4 transition-all duration-200
                            hover:scale-[1.02] hover:shadow-lg group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon size={18} className={iconCls} />
                  </div>
                  <ChevronLeft size={15} className="text-slate-600 group-hover:text-slate-400 transition-colors mt-0.5" />
                </div>
                <p className="text-sm font-bold text-slate-100 leading-tight">{label}</p>
                <p className="text-[11px] text-slate-500 mb-2">{sublabel}</p>
                {count !== null ? (
                  <p className="text-xl font-bold font-mono-num text-slate-200">
                    {count.toLocaleString('ar-EG')}
                    <span className="text-xs font-normal text-slate-500 mr-1">{unit}</span>
                  </p>
                ) : (
                  <p className={`text-sm font-semibold ${iconCls}`}>عرض التقدم ←</p>
                )}
              </NavLink>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── FLASHCARD PREVIEW ─────────────────────────────────── */}
      <motion.div {...fadeUp(0.15)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-heading flex items-center gap-2">
            <Zap size={17} className="text-teal-400" />
            بطاقات عالية الأهمية — نماذج
          </h3>
          <NavLink to="/flashcards" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
            عرض الكل ←
          </NavLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {previewCards.map((card, i) => (
            <motion.div
              key={card.cardId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="card-glass p-4 flex flex-col hover:border-teal-600/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-600">{card.cardId}</span>
                <span className="text-[10px] bg-teal-900/50 text-teal-400 px-2 py-0.5 rounded-full border border-teal-800/50">
                  {card.source}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed flex-1 mb-3">
                {card.question}
              </p>
              <div className="border-t border-slate-700/50 pt-2.5">
                <p className="text-[10px] text-slate-600 mb-0.5 uppercase tracking-wide">Answer</p>
                <p className="text-sm font-semibold text-emerald-300">{card.answer}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── SOURCE COVERAGE + SPECIALTIES ─────────────────────── */}
      <motion.div {...fadeUp(0.2)} className="grid sm:grid-cols-2 gap-4">

        {/* Source bars */}
        <div className="card-glass p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Award size={15} className="text-teal-400" />
            تغطية المصادر
          </h3>
          <div className="space-y-3">
            {Object.entries(appStats.sourceCounts).map(([src, count]) => {
              const pct = Math.round((count / sourceMax) * 100)
              return (
                <div key={src}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 truncate max-w-[75%]">{src}</span>
                    <span className="font-mono-num text-slate-300 flex-shrink-0">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: 0.3 }}
                      className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {/* totals */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'مصادر',   value: appStats.sources },
              { label: 'عائلات', value: appStats.topicFamilies },
              { label: 'مراجع',  value: 194 },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-lg font-bold font-mono-num text-gradient-teal">{value}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Specialties */}
        <div className="card-glass p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-teal-400" />
            التخصصات المُغطّاة
            <span className="text-xs text-slate-500 font-normal mr-1">({specialties.length})</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {topSpecialties.map(s => (
              <span
                key={s}
                className="text-[11px] bg-slate-800/70 text-slate-300 border border-slate-700/50 px-2.5 py-0.5 rounded-full"
              >
                {s}
              </span>
            ))}
            <NavLink
              to="/topics"
              className="text-[11px] bg-teal-900/40 text-teal-400 border border-teal-800/50
                         px-2.5 py-0.5 rounded-full hover:bg-teal-800/40 transition-colors"
            >
              +{specialties.length - topSpecialties.length} أكثر ←
            </NavLink>
          </div>

          {/* Progress breakdown */}
          <div className="mt-5 pt-4 border-t border-slate-800/60">
            <p className="text-xs text-slate-500 mb-3">توزيع حالة المراجعة</p>
            <div className="space-y-2">
              {[
                { status: PROGRESS_STATUS.MASTERED, label: 'أتقنت',   color: 'bg-emerald-500' },
                { status: PROGRESS_STATUS.LEARNING, label: 'يُراجَع', color: 'bg-amber-500'   },
                { status: PROGRESS_STATUS.WRONG,    label: 'خطأ',     color: 'bg-red-500'     },
                { status: PROGRESS_STATUS.NEW,      label: 'جديد',    color: 'bg-slate-600'   },
              ].map(({ status, label, color }) => {
                const count  = summary[status] ?? 0
                const pct    = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-mono-num text-slate-300">{count.toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className={`h-full ${color} rounded-full`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  )
}
