import { useState } from 'react'
import { motion } from 'framer-motion'
import { chapterStudyMap } from '../data/appDatabase'

export default function StudyMap() {
  const [selectedSource, setSelectedSource] = useState('الكل')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const sources = ['الكل', ...new Set(chapterStudyMap.map(c => c.source).filter(Boolean))]

  const filtered = chapterStudyMap.filter(c => {
    const srcMatch = selectedSource === 'الكل' || c.source === selectedSource
    const q = search.toLowerCase()
    const textMatch = !q ||
      c.source?.toLowerCase().includes(q) ||
      c.entries?.some(e => e.chapterTitle?.toLowerCase().includes(q) || e.topic?.toLowerCase().includes(q))
    return srcMatch && textMatch
  })

  const totalTopics = filtered.reduce((sum, c) => sum + (c.count || 0), 0)

  const sourceColors = {
    'Tintinalli': 'teal',
    'Rosen': 'blue',
  }

  const getColor = (source) => sourceColors[source] || 'purple'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">🗺 خريطة الدراسة</h1>
        <p className="text-sm text-slate-400">{chapterStudyMap.length} فصل · {totalTopics} موضوع</p>
      </div>

      {/* Source stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {sources.filter(s => s !== 'الكل').map(src => {
          const chapters = chapterStudyMap.filter(c => c.source === src)
          const topicsCount = chapters.reduce((sum, c) => sum + (c.count || 0), 0)
          const color = getColor(src)
          return (
            <button
              key={src}
              onClick={() => setSelectedSource(selectedSource === src ? 'الكل' : src)}
              className={`bg-slate-900 border rounded-xl p-4 text-right transition-colors ${
                selectedSource === src
                  ? `border-${color}-500/60 bg-${color}-900/10`
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-lg font-bold text-slate-100">{chapters.length}</p>
              <p className="text-xs text-slate-400">فصل</p>
              <p className="text-sm font-semibold text-slate-300 mt-1">{src}</p>
              <p className="text-xs text-slate-500">{topicsCount} موضوع</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في الفصول..."
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

      <div className="space-y-3">
        {filtered.map((chapter, i) => {
          const chapterTitle = chapter.entries?.[0]?.chapterTitle || `الفصل ${chapter.chapterNumber}`
          const key = `${chapter.source}_${chapter.chapterNumber}`
          const color = getColor(chapter.source)

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === key ? null : key)}
                className="w-full text-right px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`w-8 h-8 rounded-lg bg-${color}-900/40 border border-${color}-800/40 flex items-center justify-center text-${color}-400 text-xs font-bold flex-shrink-0`}>
                    {chapter.chapterNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{chapterTitle}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{chapter.source}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{chapter.count} موضوع</span>
                    </div>
                  </div>
                </div>
                <span className="text-slate-600 flex-shrink-0">{expanded === key ? '▲' : '▼'}</span>
              </button>

              {expanded === key && (
                <div className="px-5 pb-4 border-t border-slate-800/60 pt-3" dir="rtl">
                  <div className="space-y-2">
                    {chapter.entries?.map((entry, j) => (
                      <div key={entry.id} className="flex gap-3 items-start">
                        <span className="text-xs text-slate-600 font-mono mt-0.5 flex-shrink-0 w-5">{j + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300">{entry.topic}</p>
                          {entry.families?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.families.map((f, fi) => (
                                <span key={fi} className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🗺</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
