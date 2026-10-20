import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fitTone, TONE_CLASSES } from '@/lib/fit-tone'

type Props = { band: string | null; total: number | null; max: number | null; showScore?: boolean; className?: string }

/** The decision band as a traffic-light badge. */
export function FitBadge({ band, total, max, showScore = false, className }: Props) {
  const tone = fitTone(band, total, max)
  const text = [showScore && total != null && max ? `${total}/${max}` : null, band].filter(Boolean).join(' · ')
  if (!text) return <span className="text-muted-foreground">—</span>

  return (
    <Badge variant="outline" className={cn(tone && TONE_CLASSES[tone].badge, className)}>
      {tone && <span className={cn('mr-1.5 size-2 rounded-full', TONE_CLASSES[tone].dot)} aria-hidden />}
      {text}
    </Badge>
  )
}
