import { useState } from 'react'
import { motion } from 'framer-motion'
import { visualSigns } from '../data/appDatabase'

export default function VisualSigns() {
  const [search, setSearch] = useState('')
  const [selectedSource, setSelectedSource] = useState('الكل')

  const sources = ['الكل', ...new Set(visualSigns.map(v => v.source).filter(Boolean))]

  const filtered = visualSigns.filter(v => {
    const srcMatch = selectedSource === 'الكل' || v.source === selectedSource
    const q = search.toLowerCase()
    const textMatch = !q ||
      v.text?.toLowerCase().includes(q) ||
      v.topic?.toLowerCase().includes(q)
    return srcMatch && textMatch
  })

  // Group by topic
  const grouped = {}
  filtered.forEach(v => {
    const key = v.topic || 'عام'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">👁 العلامات البصرية والسريرية</h1>
        <p className="text-sm text-slate-400">{visualSigns.length} علامة تصويرية وسريرية مميزة</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في العلامات..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500"
          dir="rtl"
        />
        <select
          value={selectedSource}
          onChange={e => setSelectedSource(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-teal-500"
          dir="rtl"
        >
          {sources.map(s => <option key={s} value={s}>{s === 'الكل' ? 'كل المصادر' : s}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-5">{filtered.length} علامة</p>

      <div className="space-y-6">
        {Object.entries(grouped).map(([topicName, signs]) => (
          <div key={topicName}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-blue-400 bg-blue-900/20 border border-blue-800/30 px-3 py-1 rounded-full">
                {topicName}
              </span>
              <span className="text-xs text-slate-500">{signs.length} علامة</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {signs.map((sign, i) => (
                <motion.div
                  key={sign.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3"
                >
                  <span className="text-2xl flex-shrink-0">👁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-relaxed">{sign.text}</p>
                    {sign.source && (
                      <p className="text-xs text-slate-500 mt-2">📖 {sign.source}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">👁</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
