'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Types
type Workout = {
  id: string
  title: string
  user_id: string
  type: 'løping' | 'styrke' | 'annet' | string
  created_at?: string
}

export default function Page() { // Viktig at det heter Page!
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [stats, setStats] = useState({
    total: 0,
    week: 0,
    løping: 0,
    styrke: 0,
    annet: 0,
  })

  // === Sjekk session ===
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (err) {
        console.warn('Auth-feil:', err)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // === Hent økter + enkle stats ===
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Siste 8 for feeden
      const { data: recent, error: errRecent } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)

      if (!errRecent) setWorkouts(recent || [])

      // Total
      const { count: total } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      // Denne uka (7 dager)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: week } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)

      // Per type (løping, styrke, annet)
      const [r1, r2, r3] = await Promise.all([
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'løping'),
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'styrke'),
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'annet'),
      ])

      setStats({
        total: total ?? 0,
        week: week ?? 0,
        løping: r1.count ?? 0,
        styrke: r2.count ?? 0,
        annet: r3.count ?? 0,
      })
    }

    fetchData()
  }, [user])

  // === UI byggesteiner ===
  const Greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 6) return 'Nattugle, '
    if (hour < 10) return 'God morgen, '
    if (hour < 14) return 'God dag, '
    if (hour < 18) return 'God ettermiddag, '
    return 'God kveld, '
  }, [])

  // === Lasteskjerm ===
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center text-muted-foreground">Laster dashboard…</div>
      </div>
    )
  }

  // === Hvis ikke innlogget ===
  if (!user) {
    return (
      <div
        className="min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('/assets/Rambo-First-Blood.webp')" }}
      >
        <div className="bg-white/80 p-6 rounded-2xl shadow-xl w-full max-w-md">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Logg inn</CardTitle>
            </CardHeader>
            <CardContent>
              <AuthForm />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // === Hvis innlogget ===
  return (
    <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Toppseksjon */}
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {Greeting}{user.email?.split('@')[0] || 'athlete'}
          </h1>
          <p className="text-sm text-muted-foreground">Universelt hoveddash – alt på ett sted.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/workouts/new">
            <Button className="bg-green-600 hover:bg-green-700">➕ Ny økt</Button>
          </Link>
          <Link href="/stats">
            <Button variant="secondary">📈 Stats</Button>
          </Link>
        </div>
      </section>

      {/* KPI-kort */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totalt</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Denne uka</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.week}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">🏃 Løping</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.løping}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">🏋️ Styrke</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.styrke}</CardContent>
        </Card>
      </section>

      {/* Hurtigknapper */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/workouts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📓 Alle økter</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Se/filtrer historikk</CardContent>
          </Card>
        </Link>
        <Link href="/workouts/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">⚡ Rask registrering</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Legg til på 10 sek</CardContent>
          </Card>
        </Link>
        <Link href="/stats">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📈 Statistikk</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">KPIer og grafer</CardContent>
          </Card>
        </Link>
        <Link href="/profile">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">👤 Profil</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Innstillinger</CardContent>
          </Card>
        </Link>
      </section>

      {/* Feed: siste økter */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Siste økter</h2>
          <Link href="/workouts"><Button variant="ghost">Se alle →</Button></Link>
        </div>
        {workouts.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Ingen økter registrert ennå. Trykk «Ny økt» for å komme i gang.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {workouts.map((w) => (
              <li key={w.id} className="border rounded-md bg-white px-3 py-2 flex items-center justify-between">
                <div className="truncate">
                  <span className="mr-2">
                    {w.type === 'løping' && '🏃'}
                    {w.type === 'styrke' && '🏋️'}
                    {w.type === 'annet' && '🧘'}
                    {!['løping','styrke','annet'].includes(w.type) && '📌'}
                  </span>
                  <span className="font-semibold">{w.title}</span>
                </div>
                <Link href={`/workouts/${w.id}`} className="shrink-0">
                  <Button variant="secondary" size="sm">Åpne</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
