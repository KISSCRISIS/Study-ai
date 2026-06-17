import { useState } from 'react'
import { motion } from 'framer-motion'
import { antidotes, getTopicById } from '../data/appDatabase'

export default function Antidotes() {
  const [search, setSearch] = useState('')

  const enriched = antidotes.map(a => ({
    ...a,
    topicData: getTopicById(a.topicId),
  }))

  const filtered = enriched.filter(a => {
    const q = search.toLowerCase()
    return !q ||
      a.name?.toLowerCase().includes(q) ||
      a.topic?.toLowerCase().includes(q)
  })

  // Group by topic
  const grouped = {}
  filtered.forEach(a => {
    const key = a.topic || 'عام'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
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
        <h1 className="text-2xl font-bold text-slate-100 mb-1">💊 الترياق والعلاجات المضادة</h1>
        <p className="text-sm text-slate-400">{antidotes.length} ترياق في قاعدة البيانات</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="ابحث في الترياق..."
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 mb-6"
        dir="rtl"
      />

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="px-4 py-3 text-right text-slate-400 font-medium">#</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">الترياق / العلاج</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">الحالة / السُّم</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">معلومات إضافية</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr
                key={a.id}
                className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-slate-900/40'
                }`}
              >
                <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-semibold text-teal-300" dir="ltr">{a.name}</td>
                <td className="px-4 py-3 text-slate-300">{a.topic}</td>
                <td className="px-4 py-3">
                  {a.topicData?.arabicMentorExplanation && (
                    <span className="text-xs text-slate-400 line-clamp-2">
                      {a.topicData.arabicMentorExplanation.slice(0, 100)}...
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards grouped by topic */}
      <div className="md:hidden space-y-6">
        {Object.entries(grouped).map(([topicName, items]) => (
          <div key={topicName}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-teal-400 bg-teal-900/20 border border-teal-800/30 px-3 py-1 rounded-full">
                {topicName}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💊</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-teal-300" dir="ltr">{a.name}</p>
                      {a.topicData?.arabicMentorExplanation && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {a.topicData.arabicMentorExplanation.slice(0, 80)}...
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">💊</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
