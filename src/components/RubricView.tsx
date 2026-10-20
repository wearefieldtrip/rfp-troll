import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Rubric } from '@/lib/queries'

export function RubricView({ rubric }: { rubric: Rubric }) {
  return (
    <div className="space-y-6">
      {rubric.rubric_dimensions.map((dimension, i) => (
        <Card key={dimension.id}>
          <CardHeader>
            <CardTitle>
              {String.fromCharCode(65 + i)}. {dimension.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dimension.rubric_levels.map((level) => (
              <div key={level.id} className="flex gap-3 text-sm">
                <span className="w-6 shrink-0 font-semibold">{level.score}</span>
                <div>
                  <span className="font-medium">{level.label}</span>
                  {level.is_auto_no_go && (
                    <Badge variant="destructive" className="ml-2">
                      Auto no-go
                    </Badge>
                  )}
                  <p className="text-muted-foreground">{level.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Decision matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rubric.rubric_decision_bands.map((band) => (
            <div key={band.id} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 font-semibold">
                {band.min_score} – {band.max_score}
              </span>
              <div>
                <span className="font-medium">{band.label}</span>
                <p className="text-muted-foreground">{band.action}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
