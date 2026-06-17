import rawData from '../../data/APP_DATABASE.json'

export const metadata              = rawData.metadata
export const topics                = rawData.topics
export const officialUnifiedTopics = rawData.officialUnifiedTopics
export const expandedDerivedTopics = rawData.expandedDerivedTopics
export const referenceLibrary      = rawData.referenceLibrary
export const flashcards            = rawData.flashcards
export const numericals            = rawData.numericals
export const algorithms            = rawData.algorithms
export const antidotes             = rawData.antidotes
export const visualSigns           = rawData.visualSigns
export const examTraps             = rawData.examTraps
export const keywords              = rawData.keywords
export const arabicMentorExplanations = rawData.arabicMentorExplanations
export const topicFamilyIndex      = rawData.topicFamilyIndex
export const chapterStudyMap       = rawData.chapterStudyMap
export const searchIndex           = rawData.searchIndex
export const sourceCoverage        = rawData.sourceCoverage

export const appStats = {
  totalTopics:        topics.length,
  flashcards:         flashcards.length,
  numericals:         numericals.length,
  algorithms:         algorithms.length,
  antidotes:          antidotes.length,
  visualSigns:        visualSigns.length,
  examTraps:          examTraps.length,
  keywords:           keywords.length,
  arabicExplanations: arabicMentorExplanations.length,
  topicFamilies:      topicFamilyIndex.length,
  sources:            Object.keys(sourceCoverage.sourceCounts || {}).length,
  sourceCounts:       sourceCoverage.sourceCounts || {},
}

export const specialties = [
  ...new Set(topics.map(t => t.specialty).filter(Boolean))
].sort()

const _topicById = {}
topics.forEach(t => { _topicById[t.topicId] = t })
export const getTopicById = (id) => _topicById[id] ?? null

export const flashcardTypes    = [...new Set(flashcards.map(f => f.type).filter(Boolean))]
export const highYieldFlashcards = flashcards.filter(f => f.yield === 'High')

const _chapterByKey = {}
chapterStudyMap.forEach(c => {
  _chapterByKey[`${c.source}_${c.chapterNumber}`] = c
})
export const getChapterByKey = (source, chapterNumber) =>
  _chapterByKey[`${source}_${chapterNumber}`] ?? null

const _trapsByTopic = {}
examTraps.forEach(t => {
  const k = t.topic || 'Uncategorized'
  if (!_trapsByTopic[k]) _trapsByTopic[k] = []
  _trapsByTopic[k].push(t)
})
export const getTrapsByTopic = (topic) => _trapsByTopic[topic] ?? []
export const trapTopics       = Object.keys(_trapsByTopic).sort()

export const PROGRESS_STATUS = {
  NEW:      'new',
  LEARNING: 'learning',
  WRONG:    'wrong',
  MASTERED: 'mastered',
}

export const allCardIds = {
  flashcards:  flashcards.map(f => f.cardId),
  numericals:  numericals.map(n => n.id),
  examTraps:   examTraps.map(t => t.id),
  algorithms:  algorithms.map(a => a.id),
  antidotes:   antidotes.map(a => a.id),
  visualSigns: visualSigns.map(v => v.id),
}

export default rawData
