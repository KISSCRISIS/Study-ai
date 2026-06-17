import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Zap, Hash, AlertTriangle,
  GitBranch, Pill, Eye, Map, Search, TrendingUp,
  ChevronRight, Menu, X, Stethoscope
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',             label: 'الرئيسية',        icon: LayoutDashboard },
  { to: '/topics',       label: 'المواضيع',         icon: BookOpen        },
  { to: '/flashcards',   label: 'البطاقات',         icon: Zap             },
  { to: '/numericals',   label: 'الأرقام',          icon: Hash            },
  { to: '/traps',        label: 'مصائد الامتحان',   icon: AlertTriangle   },
  { to: '/algorithms',   label: 'الخوارزميات',      icon: GitBranch       },
  { to: '/antidotes',    label: 'الترياق',          icon: Pill            },
  { to: '/visual-signs', label: 'العلامات البصرية', icon: Eye             },
  { to: '/study-map',    label: 'خريطة الدراسة',    icon: Map             },
  { to: '/search',       label: 'البحث',            icon: Search          },
  { to: '/progress',     label: 'تقدمي',            icon: TrendingUp      },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const currentLabel = NAV_ITEMS.find(n => n.to === location.pathname)?.label ?? 'الرئيسية'

  return (
    <div className="flex min-h-screen bg-slate-950">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          'fixed top-0 right-0 h-full z-40 flex flex-col',
          'w-64 bg-slate-900 border-l border-slate-800',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0 glow-teal">
            <Stethoscope size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100 leading-tight">دليل الصحة</p>
            <p className="text-xs text-teal-400 leading-tight">الذكي</p>
          </div>
          <button
            className="mr-auto lg:hidden btn-ghost p-1.5"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={14} className="opacity-30 rotate-180" />
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 text-center leading-relaxed">
            Rosen · Tintinalli · HIPPO · FRCEM
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className="lg:hidden btn-ghost p-2"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
                <Stethoscope size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-slate-100">دليل الصحة الذكي</span>
            </div>
            <h1 className="hidden lg:block text-base font-semibold text-slate-200">
              {currentLabel}
            </h1>
            <div className="mr-auto flex items-center gap-2">
              <NavLink to="/search" className="btn-ghost p-2">
                <Search size={18} />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>

        <footer className="disclaimer-bar sticky bottom-0">
          <span className="font-semibold text-amber-400">⚠ تنبيه:</span>{' '}
          هذا التطبيق للتحضير للامتحانات الطبية فقط وليس بديلاً عن استشارة طبية
        </footer>
      </div>
    </div>
  )
}
