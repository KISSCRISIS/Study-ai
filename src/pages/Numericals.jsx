import { useState } from 'react'
import { motion } from 'framer-motion'
import { numericals } from '../data/appDatabase'

export default function Numericals() {
  const [search, setSearch] = useState('')

  const filtered = numericals.filter(n => {
    const q = search.toLowerCase()
    return !q ||
      n.answer?.toLowerCase().includes(q) ||
      n.explanation?.toLowerCase().includes(q) ||
      n.questionNumber?.toLowerCase().includes(q)
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
        <h1 className="text-2xl font-bold text-slate-100 mb-1"># الأرقام والقيم</h1>
        <p className="text-sm text-slate-400">{numericals.length} قيمة عددية للامتحانات</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="ابحث في الأرقام..."
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 mb-4"
        dir="rtl"
      />

      <p className="text-xs text-slate-500 mb-4">{filtered.length} نتيجة</p>

      {/* Table for desktop, cards for mobile */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="px-4 py-3 text-right text-slate-400 font-medium">رقم السؤال</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">الإجابة / القيمة</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">الشرح / الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n, i) => (
              <tr
                key={n.id}
                className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-slate-900/50'
                }`}
              >
                <td className="px-4 py-3 text-slate-400 text-xs font-mono">{n.questionNumber || n.id}</td>
                <td className="px-4 py-3 text-teal-300 font-semibold" dir="ltr">{n.answer}</td>
                <td className="px-4 py-3 text-slate-300">{n.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-slate-500 font-mono">{n.questionNumber || n.id}</span>
            </div>
            <p className="text-lg font-bold text-teal-300 mb-1" dir="ltr">{n.answer}</p>
            <p className="text-sm text-slate-400">{n.explanation}</p>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">#</p>
          <p>لا توجد نتائج مطابقة</p>
        </div>
      )}
    </motion.div>
  )
}
