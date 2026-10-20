export type FitTone = 'green' | 'yellow' | 'orange' | 'red'

/**
 * Traffic-light color for a decision band. The rubric is free text, so the band is read by its wording first
 * ("Definite Go", "Conditional Go", "Likely No-Go"...) and falls back to how high the score is.
 */
export function fitTone(band: string | null, total: number | null, max: number | null): FitTone | null {
  const label = (band ?? '').toLowerCase()

  if (/\bno[\s-]?go\b|\bpass\b|\bdecline\b/.test(label)) return /likely|probabl|lean/.test(label) ? 'orange' : 'red'
  if (/conditional|maybe|possible|caution|\bif\b/.test(label)) return 'yellow'
  if (/\bgo\b|proceed|pursue/.test(label)) return 'green'

  if (total == null || !max) return null
  const ratio = total / max
  return ratio >= 0.75 ? 'green' : ratio >= 0.5 ? 'yellow' : ratio >= 0.33 ? 'orange' : 'red'
}

export const TONE_CLASSES: Record<FitTone, { badge: string; dot: string }> = {
  green: {
    badge: 'border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
    dot: 'bg-green-500',
  },
  yellow: {
    badge: 'border-yellow-300 bg-yellow-100 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    dot: 'bg-yellow-400',
  },
  orange: {
    badge: 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
    dot: 'bg-orange-500',
  },
  red: {
    badge: 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
    dot: 'bg-red-500',
  },
}
