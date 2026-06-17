import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { flashcards, PROGRESS_STATUS } from '../data/appDatabase'
import { useProgress } from '../hooks/useProgress'

export default function Flashcards() {
  const { getStatus, setStatus, sectionSummary, recordStudy } = useProgress()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [filterYield, setFilterYield] = useState('الكل')
  const [filterType, setFilterType] = useState('الكل')

  const types = useMemo(() => ['الكل', ...new Set(flashcards.map(f => f.type).filter(Boolean))], [])
  const yields = ['الكل', 'High', 'Medium', 'Low']

  const deck = useMemo(() => flashcards.filter(f => {
    const yMatch = filterYield === 'الكل' || f.yield === filterYield
    const tMatch = filterType === 'الكل' || f.type === filterType
    return yMatch && tMatch
  }), [filterYield, filterType])

  const card = deck[currentIndex]
  const ids = useMemo(() => deck.map(f => f.cardId), [deck])
  const summary = sectionSummary(ids)

  const go = (dir) => {
    setRevealed(false)
    setCurrentIndex(i => {
      const next = i + dir
      if (next < 0) return deck.length - 1
      if (next >= deck.length) return 0
      return next
    })
  }

  const mark = (status) => {
    if (!card) return
    setStatus(card.cardId, status)
    recordStudy('flashcards', card.cardId)
    go(1)
  }

  const statusColor = {
    [PROGRESS_STATUS.NEW]: 'text-slate-400',
    [PROGRESS_STATUS.LEARNING]: 'text-yellow-400',
    [PROGRESS_STATUS.WRONG]: 'text-red-400',
    [PROGRESS_STATUS.MASTERED]: 'text-teal-400',
  }

  if (!card) return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-500">
      لا توجد بطاقات مطابقة
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-2xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">⚡ البطاقات التعليمية</h1>
        <div className="flex gap-4 text-xs mt-2">
          <span className="text-slate-500">الإجمالي: <strong className="text-slate-300">{deck.length}</strong></span>
          <span className="text-teal-400">أتقنت: <strong>{summary[PROGRESS_STATUS.MASTERED]}</strong></span>
          <span className="text-yellow-400">قيد المراجعة: <strong>{summary[PROGRESS_STATUS.LEARNING]}</strong></span>
          <span className="text-red-400">خاطئة: <strong>{summary[PROGRESS_STATUS.WRONG]}</strong></span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all duration-500"
          style={{ width: `${summary.total ? (summary[PROGRESS_STATUS.MASTERED] / summary.total) * 100 : 0}%` }}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <select
          value={filterYield}
          onChange={e => { setFilterYield(e.target.value); setCurrentIndex(0); setRevealed(false) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
        >
          {yields.map(y => <option key={y}>{y}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setCurrentIndex(0); setRevealed(false) }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
        >
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500 self-center mr-auto">
          {currentIndex + 1} / {deck.length}
        </span>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.cardId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-4"
        >
          <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
            <div className="flex gap-2">
              {card.yield && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  card.yield === 'High' ? 'bg-yellow-900/30 border-yellow-800/40 text-yellow-400' :
                  card.yield === 'Medium' ? 'bg-blue-900/30 border-blue-800/40 text-blue-400' :
                  'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {card.yield === 'High' ? '🔥 عالي الأهمية' : card.yield === 'Medium' ? '📘 متوسط' : '📗 منخفض'}
                </span>
              )}
              {card.type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                  {card.type}
                </span>
              )}
            </div>
            <span className={`text-xs ${statusColor[getStatus(card.cardId)]}`}>
              {getStatus(card.cardId) === PROGRESS_STATUS.NEW ? 'جديدة' :
               getStatus(card.cardId) === PROGRESS_STATUS.LEARNING ? 'قيد المراجعة' :
               getStatus(card.cardId) === PROGRESS_STATUS.WRONG ? 'خاطئة' : '✓ أتقنتها'}
            </span>
          </div>

          <div className="p-5">
            <p className="text-sm text-slate-400 mb-1">السؤال</p>
            <p className="text-base text-slate-100 leading-relaxed" dir="ltr">{card.question}</p>
          </div>

          <div className="px-5 pb-5">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 bg-teal-700/30 border border-teal-700/50 hover:bg-teal-700/50 text-teal-300 rounded-xl text-sm font-medium transition-colors"
              >
                👁 إظهار الإجابة
              </button>
            ) : (
              <div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-1">الإجابة</p>
                  <p className="text-sm text-teal-300 font-medium leading-relaxed" dir="ltr">{card.answer}</p>
                  {card.source && (
                    <p className="text-xs text-slate-500 mt-2">📖 {card.source}</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => mark(PROGRESS_STATUS.WRONG)}
                    className="py-2.5 bg-red-900/30 border border-red-800/40 hover:bg-red-900/60 text-red-400 rounded-xl text-xs font-medium transition-colors">
                    ✗ خاطئ
                  </button>
                  <button onClick={() => mark(PROGRESS_STATUS.LEARNING)}
                    className="py-2.5 bg-yellow-900/30 border border-yellow-800/40 hover:bg-yellow-900/60 text-yellow-400 rounded-xl text-xs font-medium transition-colors">
                    ~ للمراجعة
                  </button>
                  <button onClick={() => mark(PROGRESS_STATUS.MASTERED)}
                    className="py-2.5 bg-teal-900/30 border border-teal-800/40 hover:bg-teal-900/60 text-teal-400 rounded-xl text-xs font-medium transition-colors">
                    ✓ أتقنتها
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3">
        <button onClick={() => go(-1)}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
          ← السابقة
        </button>
        <button onClick={() => go(1)}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
          التالية →
        </button>
      </div>
    </motion.div>
  )
}
