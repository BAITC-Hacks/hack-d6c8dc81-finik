// An explanation refresh may change wording only, never confirmed progress or ranking.
export function mergeExplanationRefresh(confirmed, refreshed) {
  const facts = (item) => Object.fromEntries(Object.entries(item).filter(([key]) =>
    key !== 'explanation' && key !== 'explanation_source',
  ))
  if (JSON.stringify(confirmed.map(facts)) !== JSON.stringify(refreshed.map(facts))) return confirmed
  return confirmed.map((item, index) => ({
    ...item,
    explanation: refreshed[index].explanation,
    explanation_source: refreshed[index].explanation_source ?? 'rules',
  }))
}
