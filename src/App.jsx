import { Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'

const PLACEHOLDER_META = {
  '/topics':       { icon: '📚', ar: 'المواضيع',         en: 'Topics',       desc: 'تصفح المواضيع الطبية حسب التخصص أو المصدر' },
  '/flashcards':   { icon: '⚡', ar: 'البطاقات',         en: 'Flashcards',   desc: 'راجع البطاقات التعليمية بنظام التقدم الرباعي' },
  '/numericals':   { icon: '#',  ar: 'الأرقام',          en: 'Numericals',   desc: 'الجرعات والقيم العددية الحيوية للامتحانات' },
  '/traps':        { icon: '⚠', ar: 'مصائد الامتحان',   en: 'Exam Traps',   desc: 'الأخطاء الشائعة التي يقع فيها الممتحنون' },
  '/algorithms':   { icon: '⑂', ar: 'الخوارزميات',      en: 'Algorithms',   desc: 'خوارزميات التشخيص والعلاج المنظمة' },
  '/antidotes':    { icon: '💊', ar: 'الترياق',          en: 'Antidotes',    desc: 'جدول الترياق والعلاج المضاد للسموم' },
  '/visual-signs': { icon: '👁', ar: 'العلامات البصرية', en: 'Visual Signs', desc: 'العلامات التصويرية والسريرية المميزة' },
  '/study-map':    { icon: '🗺', ar: 'خريطة الدراسة',    en: 'Study Map',    desc: 'خريطة الفصول والمصادر للمراجعة المنظمة' },
  '/search':       { icon: '🔍', ar: 'البحث',            en: 'Search',       desc: 'البحث في كامل قاعدة البيانات' },
  '/progress':     { icon: '📈', ar: 'تقدمي',            en: 'Progress',     desc: 'تتبع تقدمك ونسبة الإتقان لكل قسم' },
}

function Placeholder() {
  const { pathname } = useLocation()
  const meta = PLACEHOLDER_META[pathname] ?? {
    icon: '🔧', ar: 'قيد البناء', en: 'Coming Soon', desc: 'هذا القسم تحت الإنشاء'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4 px-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-teal-900/30 border border-teal-800/40 flex items-center justify-center text-4xl mb-2">
        {meta.icon}
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">{meta.ar}</h2>
        <p className="text-sm text-teal-400 mb-3 font-mono">{meta.en}</p>
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{meta.desc}</p>
      </div>
      <div className="mt-2 bg-slate-900/60 border border-slate-700/50 rounded-xl px-5 py-3">
        <p className="text-xs text-slate-500">
          🚧 هذا القسم سيكون جاهزاً في المرحلة القادمة
        </p>
      </div>
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"             element={<Dashboard />}   />
          <Route path="/topics"       element={<Placeholder />} />
          <Route path="/flashcards"   element={<Placeholder />} />
          <Route path="/numericals"   element={<Placeholder />} />
          <Route path="/traps"        element={<Placeholder />} />
          <Route path="/algorithms"   element={<Placeholder />} />
          <Route path="/antidotes"    element={<Placeholder />} />
          <Route path="/visual-signs" element={<Placeholder />} />
          <Route path="/study-map"    element={<Placeholder />} />
          <Route path="/search"       element={<Placeholder />} />
          <Route path="/progress"     element={<Placeholder />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}
