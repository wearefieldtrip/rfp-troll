import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { activeRubricQuery } from '@/lib/queries'

export default function RubricPage() {
  const { data: rubric, isPending, error } = useQuery(activeRubricQuery)

  if (isPending) return <Skeleton className="h-64 w-full max-w-3xl" />
  if (error) return <p className="text-destructive">Could not load the rubric.</p>

  const maxTotal = rubric.rubric_dimensions.length * rubric.scale_max

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rubric</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Version {rubric.version}. Each dimension is scored 0 to {rubric.scale_max}, for a total out of {maxTotal}.
        </p>
      </div>

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
