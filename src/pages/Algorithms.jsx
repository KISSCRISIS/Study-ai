import { useState } from 'react'
import { motion } from 'framer-motion'
import { algorithms } from '../data/appDatabase'

export default function Algorithms() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const filtered = algorithms.filter(a => {
    const q = search.toLowerCase()
    return !q ||
      a.name?.toLowerCase().includes(q) ||
      a.topic?.toLowerCase().includes(q) ||
      a.source?.toLowerCase().includes(q)
  })

  const sources = [...new Set(algorithms.map(a => a.source).filter(Boolean))]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">⑂ الخوارزميات</h1>
        <p className="text-sm text-slate-400">{algorithms.length} خوارزمية تشخيصية وعلاجية</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="ابحث في الخوارزميات..."
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 mb-6"
        dir="rtl"
      />

      <p className="text-xs text-slate-500 mb-4">{filtered.length} خوارزمية</p>

      <div className="grid gap-4">
        {filtered.map((alg, i) => (
          <motion.div
            key={alg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === alg.id ? null : alg.id)}
              className="w-full text-right px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="w-7 h-7 rounded-lg bg-purple-900/40 border border-purple-800/40 flex items-center justify-center text-purple-400 text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-base font-semibold text-slate-100">{alg.name}</span>
                </div>
                <div className="flex gap-2 mr-10">
                  <span className="text-xs text-slate-500">{alg.topic}</span>
                  {alg.source && (
                    <span className="text-xs bg-purple-900/20 text-purple-400 border border-purple-800/30 px-2 py-0.5 rounded-full">
                      {alg.source}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-slate-600 mt-1">{expanded === alg.id ? '▲' : '▼'}</span>
            </button>

            {expanded === alg.id && (
              <div className="px-5 pb-5 border-t border-slate-800/60 pt-4" dir="rtl">
                <div className="bg-slate-800/40 rounded-xl p-4">
                  <p className="text-xs font-semibold text-purple-400 mb-3">📋 تفاصيل الخوارزمية</p>
                  <div className="space-y-2">
                    <div className="flex gap-2 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0">الاسم:</span>
                      <span className="text-slate-200">{alg.name}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0">الموضوع:</span>
                      <span className="text-slate-200">{alg.topic}</span>
                    </div>
                    {alg.source && (
                      <div className="flex gap-2 text-sm">
                        <span className="text-slate-500 w-20 flex-shrink-0">المصدر:</span>
                        <span className="text-slate-200">{alg.source}</span>
                      </div>
                    )}
                    {alg.referenceId && (
                      <div className="flex gap-2 text-sm">
                        <span className="text-slate-500 w-20 flex-shrink-0">المرجع:</span>
                        <span className="text-slate-400 font-mono text-xs">{alg.referenceId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">⑂</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
