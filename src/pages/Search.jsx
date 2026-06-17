import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  topics, flashcards, examTraps, algorithms, antidotes, visualSigns, numericals
} from '../data/appDatabase'

const SECTIONS = [
  {
    key: 'topics',
    label: 'المواضيع',
    icon: '📚',
    data: topics,
    search: (item, q) =>
      item.topicName?.toLowerCase().includes(q) ||
      item.specialty?.toLowerCase().includes(q) ||
      item.arabicMentorExplanation?.toLowerCase().includes(q),
    render: item => ({
      title: item.topicName,
      subtitle: item.specialty,
      detail: item.arabicMentorExplanation?.slice(0, 100),
    }),
  },
  {
    key: 'flashcards',
    label: 'البطاقات',
    icon: '⚡',
    data: flashcards,
    search: (item, q) =>
      item.question?.toLowerCase().includes(q) ||
      item.answer?.toLowerCase().includes(q),
    render: item => ({
      title: item.question?.slice(0, 80),
      subtitle: `الإجابة: ${item.answer}`,
      detail: item.source,
    }),
  },
  {
    key: 'examTraps',
    label: 'مصائد الامتحان',
    icon: '⚠️',
    data: examTraps,
    search: (item, q) =>
      item.text?.toLowerCase().includes(q) ||
      item.topic?.toLowerCase().includes(q),
    render: item => ({
      title: item.text?.slice(0, 100),
      subtitle: item.topic,
      detail: item.source,
    }),
  },
  {
    key: 'algorithms',
    label: 'الخوارزميات',
    icon: '⑂',
    data: algorithms,
    search: (item, q) =>
      item.name?.toLowerCase().includes(q) ||
      item.topic?.toLowerCase().includes(q),
    render: item => ({
      title: item.name,
      subtitle: item.topic,
      detail: item.source,
    }),
  },
  {
    key: 'antidotes',
    label: 'الترياق',
    icon: '💊',
    data: antidotes,
    search: (item, q) =>
      item.name?.toLowerCase().includes(q) ||
      item.topic?.toLowerCase().includes(q),
    render: item => ({
      title: item.name,
      subtitle: item.topic,
    }),
  },
  {
    key: 'visualSigns',
    label: 'العلامات البصرية',
    icon: '👁',
    data: visualSigns,
    search: (item, q) =>
      item.text?.toLowerCase().includes(q) ||
      item.topic?.toLowerCase().includes(q),
    render: item => ({
      title: item.text,
      subtitle: item.topic,
      detail: item.source,
    }),
  },
  {
    key: 'numericals',
    label: 'الأرقام',
    icon: '#',
    data: numericals,
    search: (item, q) =>
      item.answer?.toLowerCase().includes(q) ||
      item.explanation?.toLowerCase().includes(q),
    render: item => ({
      title: item.explanation,
      subtitle: `القيمة: ${item.answer}`,
    }),
  },
]

export default function Search() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.length < 2) return {}
    const out = {}
    SECTIONS.forEach(sec => {
      const matches = sec.data.filter(item => sec.search(item, q))
      if (matches.length > 0) out[sec.key] = { ...sec, matches }
    })
    return out
  }, [query])

  const totalResults = Object.values(results).reduce((sum, s) => sum + s.matches.length, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">🔍 البحث الشامل</h1>
        <p className="text-sm text-slate-400">ابحث في كامل قاعدة البيانات</p>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="اكتب للبحث في المواضيع، البطاقات، المصائد..."
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-teal-500 pr-12"
          dir="rtl"
          autoFocus
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
      </div>

      {query.length >= 2 && (
        <p className="text-xs text-slate-500 mb-5">
          {totalResults} نتيجة في {Object.keys(results).length} قسم
        </p>
      )}

      {query.length < 2 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-slate-400">اكتب كلمتين على الأقل للبحث</p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {['pneumonia', 'sepsis', 'trauma', 'ECG', 'toxicity'].map(hint => (
              <button
                key={hint}
                onClick={() => setQuery(hint)}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 rounded-full transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {query.length >= 2 && totalResults === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">😔</p>
          <p>لا توجد نتائج لـ "{query}"</p>
        </div>
      )}

      {Object.values(results).map(section => (
        <div key={section.key} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{section.icon}</span>
            <h2 className="text-base font-bold text-slate-200">{section.label}</h2>
            <span className="text-xs bg-teal-900/30 text-teal-400 border border-teal-800/30 px-2 py-0.5 rounded-full">
              {section.matches.length}
            </span>
          </div>

          <div className="space-y-2">
            {section.matches.slice(0, 10).map((item, i) => {
              const rendered = section.render(item)
              return (
                <motion.div
                  key={item.id || item.cardId || item.topicId || i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                >
                  <p className="text-sm text-slate-200 leading-relaxed">{rendered.title}</p>
                  {rendered.subtitle && (
                    <p className="text-xs text-teal-400 mt-1">{rendered.subtitle}</p>
                  )}
                  {rendered.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{rendered.detail}</p>
                  )}
                </motion.div>
              )
            })}
            {section.matches.length > 10 && (
              <p className="text-xs text-slate-500 text-center py-2">
                + {section.matches.length - 10} نتائج أخرى
              </p>
            )}
          </div>
        </div>
      ))}
    </motion.div>
  )
}
