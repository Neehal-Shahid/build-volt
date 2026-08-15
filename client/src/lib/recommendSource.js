// Shared labels/tones for the `recommendations.source` column, used by any
// dashboard table that lists recommendation activity (Overview, Analytics).
const SOURCE_LABELS = { ai: "AI", heuristic: "Catalog match", cached: "Cached" };
const SOURCE_TONES = { ai: "blue", heuristic: "amber", cached: "gray" };

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || "—";
}

export function sourceTone(source) {
  return SOURCE_TONES[source] || "gray";
}
