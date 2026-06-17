import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { examTraps, trapTopics } from '../data/appDatabase'

export default function ExamTraps() {
  const [search, setSearch] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('الكل')

  const filtered = useMemo(() => examTraps.filter(t => {
    const topicMatch = selectedTopic === 'الكل' || t.topic === selectedTopic
    const q = search.toLowerCase()
    const textMatch = !q ||
      t.text?.toLowerCase().includes(q) ||
      t.topic?.toLowerCase().includes(q)
    return topicMatch && textMatch
  }), [search, selectedTopic])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const key = t.topic || 'عام'
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [filtered])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">⚠️ مصائد الامتحان</h1>
        <p className="text-sm text-slate-400">{examTraps.length} فخ امتحاني شائع</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في المصائد..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500"
          dir="rtl"
        />
        <select
          value={selectedTopic}
          onChange={e => setSelectedTopic(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-teal-500 max-w-xs"
          dir="rtl"
        >
          <option value="الكل">كل المواضيع</option>
          {trapTopics.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-5">{filtered.length} مصيدة</p>

      {Object.entries(grouped).map(([topicName, traps]) => (
        <div key={topicName} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-orange-400 bg-orange-900/20 border border-orange-800/30 px-3 py-1 rounded-full">
              {topicName}
            </span>
            <span className="text-xs text-slate-500">{traps.length} مصيدة</span>
          </div>
          <div className="space-y-2">
            {traps.map((trap, i) => (
              <motion.div
                key={trap.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-slate-900 border-r-4 border-red-500/60 border-t border-b border-l border-slate-800 rounded-r-xl rounded-l-xl pl-4 pr-5 py-3"
              >
                <div className="flex gap-2">
                  <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm text-slate-200 leading-relaxed">{trap.text}</p>
                    {trap.source && (
                      <p className="text-xs text-slate-500 mt-1.5">📖 {trap.source}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">⚠️</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
