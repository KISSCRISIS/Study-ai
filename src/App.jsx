import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Topics from './pages/Topics'
import Flashcards from './pages/Flashcards'
import Numericals from './pages/Numericals'
import ExamTraps from './pages/ExamTraps'
import Algorithms from './pages/Algorithms'
import Antidotes from './pages/Antidotes'
import VisualSigns from './pages/VisualSigns'
import StudyMap from './pages/StudyMap'
import Search from './pages/Search'
import Progress from './pages/Progress'

export default function App() {
  const location = useLocation()

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"             element={<Dashboard />}   />
          <Route path="/topics"       element={<Topics />}      />
          <Route path="/flashcards"   element={<Flashcards />}  />
          <Route path="/numericals"   element={<Numericals />}  />
          <Route path="/traps"        element={<ExamTraps />}   />
          <Route path="/algorithms"   element={<Algorithms />}  />
          <Route path="/antidotes"    element={<Antidotes />}   />
          <Route path="/visual-signs" element={<VisualSigns />} />
          <Route path="/study-map"    element={<StudyMap />}    />
          <Route path="/search"       element={<Search />}      />
          <Route path="/progress"     element={<Progress />}    />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}
