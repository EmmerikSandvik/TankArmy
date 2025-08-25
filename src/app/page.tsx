'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Workout = {
  id: string
  title: string
  type: 'løping' | 'styrke' | 'annet'
  distance?: number | null
  total_time?: string | null
  zone?: number | null
  created_at?: string | null
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)

      if (user) {
        const { data } = await supabase
          .from('workouts')
          .select('id,title,type,distance,total_time,zone,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
        setWorkouts(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  // Enkle summer for uke (placeholder – oppgradering senere)
  const weekSummary = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - 6) // siste 7 dager
    const inRange = workouts.filter(w => {
      if (!w.created_at) return false
      const d = new Date(w.created_at)
      return d >= start && d <= now
    })
    const runs = inRange.filter(w => w.type === 'løping')
    const styrke = inRange.filter(w => w.type === 'styrke')
    const annet = inRange.filter(w => w.type === 'annet')

    const km = runs.reduce((sum, w) => sum + (Number(w.distance) || 0), 0)
    const sessions = inRange.length

    return { sessions, km: Number(km.toFixed(1)), styrke: styrke.length, annet: annet.length }
  }, [workouts])

  if (!userEmail) {
    // Ikke innlogget → universell “landing”
    return (
      <main className="mx-auto max-w-5xl p-6">
        <section className="text-center py-12">
          <h1 className="text-3xl font-bold mb-2">TankArmy — tren smartere</h1>
          <p className="text-muted-foreground mb-6">
            Loggfør økter, følg fremgang og bygg vaner. Profiler og “følg andre” kommer snart.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/workouts">
              <Button>Se økter (demo)</Button>
            </Link>
            <Link href="/auth">
              <Button variant="outline">Logg inn / Registrer</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Loggføring</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Løping, styrke og “annet”. Enkelt skjema, rene data.
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Statistikk</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Uke-/månedssummer og trender. Visualiseringer senere.
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sosialt (kommer snart)</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Profiler, følg venner og se feed. Plassholder ligger klar i koden.
            </CardContent>
          </Card>
        </section>
      </main>
    )
  }

  // Innlogget → dashboard
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ditt dashboard</h1>
        <Link href="/workouts/new">
          <Button>+ Legg til ny økt</Button>
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {/* Hurtighandlinger */}
        <Card>
          <CardHeader><CardTitle>Hurtighandlinger</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/workouts/new?type=løping"><Button variant="outline">🏃 Ny løpeøkt</Button></Link>
            <Link href="/workouts/new?type=styrke"><Button variant="outline">🏋️ Ny styrkeøkt</Button></Link>
            <Link href="/workouts/new?type=annet"><Button variant="outline">🧘 Ny “annet”-økt</Button></Link>
            <Link href="/stats"><Button variant="secondary">📈 Gå til statistikk</Button></Link>
          </CardContent>
        </Card>

        {/* Ukesoppsummering */}
        <Card>
          <CardHeader><CardTitle>Siste 7 dager</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2 text-sm text-muted-foreground">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ) : (
              <ul className="text-sm space-y-1">
                <li><strong>Økter:</strong> {weekSummary.sessions}</li>
                <li><strong>Løpte km:</strong> {weekSummary.km}</li>
                <li><strong>Styrkeøkter:</strong> {weekSummary.styrke}</li>
                <li><strong>Annet:</strong> {weekSummary.annet}</li>
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Sosialt / kommer snart */}
        <Card>
          <CardHeader><CardTitle>Sosialt</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Profiler og “følg andre” er ikke klart ennå.  
            <div className="mt-3">
              <Link href="/profile"><Button variant="outline">Min profil (WIP)</Button></Link>
              <div className="text-xs mt-2">Tipset: Ha et klart kort her fra dag 1, så ser siden komplett ut selv før funksjonen finnes.</div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Siste økter */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Siste økter</CardTitle>
            <Link href="/workouts"><Button variant="outline">Vis alle</Button></Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
              </div>
            ) : workouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen økter ennå. Loggfør din første!</p>
            ) : (
              <ul className="divide-y">
                {workouts.map(w => (
                  <li key={w.id} className="py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{w.type === 'løping' ? '🏃' : w.type === 'styrke' ? '🏋️' : '🧘'}</span>
                      <span className="font-medium">{w.title}</span>
                      <span className="text-muted-foreground">
                        • {w.type}
                        {w.type === 'løping' && w.distance ? ` • ${w.distance} km` : ''}
                      </span>
                    </div>
                    <Link className="text-blue-600 hover:underline" href={`/workouts`}>Detaljer</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
