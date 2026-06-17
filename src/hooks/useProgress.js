import { useState, useCallback, useEffect } from 'react'
import { PROGRESS_STATUS, allCardIds } from '../data/appDatabase'

const STORAGE_KEY   = 'dhs_progress_v1'
const LAST_STUDY_KEY = 'dhs_last_study_v1'

function buildInitialProgress() {
  const map = {}
  Object.values(allCardIds).forEach(ids => {
    ids.forEach(id => { map[id] = PROGRESS_STATUS.NEW })
  })
  return map
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function loadLastStudy() {
  try {
    const raw = localStorage.getItem(LAST_STUDY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveLastStudy(data) {
  try { localStorage.setItem(LAST_STUDY_KEY, JSON.stringify(data)) } catch {}
}

function computeSummary(progressMap) {
  const summary = {
    [PROGRESS_STATUS.NEW]:      0,
    [PROGRESS_STATUS.LEARNING]: 0,
    [PROGRESS_STATUS.WRONG]:    0,
    [PROGRESS_STATUS.MASTERED]: 0,
    total: 0,
  }
  Object.values(progressMap).forEach(status => {
    summary[status] = (summary[status] ?? 0) + 1
    summary.total  += 1
  })
  summary.percentMastered = summary.total > 0
    ? Math.round((summary[PROGRESS_STATUS.MASTERED] / summary.total) * 100)
    : 0
  return summary
}

export function useProgress() {
  const [progress, setProgress] = useState(() => {
    const stored = loadFromStorage()
    return stored ?? buildInitialProgress()
  })
  const [lastStudy, setLastStudy] = useState(() => loadLastStudy())

  useEffect(() => { saveToStorage(progress) }, [progress])

  const summary   = computeSummary(progress)

  const setStatus = useCallback((cardId, status) => {
    if (!Object.values(PROGRESS_STATUS).includes(status)) return
    setProgress(prev => ({ ...prev, [cardId]: status }))
  }, [])

  const resetAll  = useCallback(() => {
    const fresh = buildInitialProgress()
    setProgress(fresh)
    saveToStorage(fresh)
  }, [])

  const resetCard = useCallback((cardId) => {
    setProgress(prev => ({ ...prev, [cardId]: PROGRESS_STATUS.NEW }))
  }, [])

  const getStatus = useCallback(
    (cardId) => progress[cardId] ?? PROGRESS_STATUS.NEW,
    [progress]
  )

  const recordStudy = useCallback((section, cardId) => {
    const entry = { section, cardId, timestamp: Date.now() }
    setLastStudy(entry)
    saveLastStudy(entry)
  }, [])

  const sectionSummary = useCallback((sectionIds = []) => {
    const counts = {
      [PROGRESS_STATUS.NEW]:      0,
      [PROGRESS_STATUS.LEARNING]: 0,
      [PROGRESS_STATUS.WRONG]:    0,
      [PROGRESS_STATUS.MASTERED]: 0,
      total: sectionIds.length,
    }
    sectionIds.forEach(id => {
      const s = progress[id] ?? PROGRESS_STATUS.NEW
      counts[s] = (counts[s] ?? 0) + 1
    })
    return counts
  }, [progress])

  return {
    progress, summary, setStatus, resetAll,
    resetCard, getStatus, lastStudy, recordStudy, sectionSummary,
  }
}
