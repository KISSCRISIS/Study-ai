import { useState } from 'react'
import { motion } from 'framer-motion'
import { topics, specialties } from '../data/appDatabase'

export default function Topics() {
  const [search, setSearch] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('الكل')
  const [expanded, setExpanded] = useState(null)

  const filtered = topics.filter(t => {
    const matchSpec = selectedSpecialty === 'الكل' || t.specialty === selectedSpecialty
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.topicName?.toLowerCase().includes(q) ||
      t.specialty?.toLowerCase().includes(q) ||
      t.arabicMentorExplanation?.toLowerCase().includes(q)
    return matchSpec && matchSearch
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-5xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">📚 المواضيع الطبية</h1>
        <p className="text-sm text-slate-400">{topics.length} موضوع من مصادر متعددة</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في المواضيع..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500"
          dir="rtl"
        />
        <select
          value={selectedSpecialty}
          onChange={e => setSelectedSpecialty(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-teal-500"
          dir="rtl"
        >
          <option value="الكل">كل التخصصات</option>
          {specialties.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500 mb-4">{filtered.length} نتيجة</p>

      <div className="grid gap-3">
        {filtered.map((topic, i) => (
          <motion.div
            key={topic.topicId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === topic.topicId ? null : topic.topicId)}
              className="w-full text-right px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-slate-100">{topic.topicName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs bg-teal-900/40 text-teal-400 border border-teal-800/40 px-2 py-0.5 rounded-full">
                    {topic.specialty}
                  </span>
                  <span className="text-xs text-slate-500">{topic.topicId}</span>
                </div>
              </div>
              <span className="text-slate-500 mt-1 flex-shrink-0">
                {expanded === topic.topicId ? '▲' : '▼'}
              </span>
            </button>

            {expanded === topic.topicId && (
              <div className="px-5 pb-5 border-t border-slate-800/60 pt-4 space-y-4" dir="rtl">
                {topic.arabicMentorExplanation && (
                  <div>
                    <p className="text-xs font-semibold text-teal-400 mb-1">💬 الشرح</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{topic.arabicMentorExplanation}</p>
                  </div>
                )}
                {topic.highYieldFacts?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 mb-2">⭐ أهم النقاط</p>
                    <ul className="space-y-1.5">
                      {topic.highYieldFacts.map((f, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex gap-2">
                          <span className="text-yellow-500 flex-shrink-0">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {topic.examTraps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-2">⚠️ مصائد الامتحان</p>
                    <ul className="space-y-1">
                      {topic.examTraps.map((trap, idx) => (
                        <li key={idx} className="text-sm text-slate-400 flex gap-2">
                          <span className="text-red-500 flex-shrink-0">!</span>
                          <span>{typeof trap === 'string' ? trap : trap.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🔍</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
