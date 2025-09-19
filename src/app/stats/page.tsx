'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { User } from '@supabase/supabase-js'

// Types
type StrengthExercise = {
  exercise: string
  category: string
  sets: number
  reps: number
  weight: number
  rpe: number
}

type WorkoutType = 'løping' | 'styrke' | 'annet'

type Workout = {
  id: string
  title: string
  user_id: string
  type: WorkoutType
  distance?: number | null
  zone?: number | null
  total_time?: string | null
  strength_exercises?: StrengthExercise[] | null
  description?: string | null
  created_at?: string
}

// --- Utils ---
const parseHms = (txt?: string | null): number => {
  if (!txt) return 0
  const parts = txt.split(':').map(p => Number(p))
  if (parts.some(isNaN)) return 0
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return m * 60 + s
  }
  if (parts.length === 1) return parts[0]
  return 0
}

const formatDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

const formatPace = (secPerKm: number): string => {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '-'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2,'0')} /km`
}

const monthKey = (iso?: string) => {
  if (!iso) return 'Ukjent'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// --- Component helpers ---
function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs sm:text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-lg sm:text-2xl font-semibold">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

type RangeKey = '7d' | '30d' | '90d' | 'all'

// --- Page ---
export default function StatsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>('30d')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data: userData } = await supabase.auth.getUser()
      const me = userData.user ?? null
      if (mounted) setUser(me)

      let query = supabase.from('workouts').select('*').order('created_at', { ascending: false })
      if (me) query = query.eq('user_id', me.id)

      const { data, error } = await query
      if (!mounted) return
      if (error) {
        setError(error.message ?? 'Kunne ikke hente økter')
        setWorkouts([])
      } else {
        setWorkouts((data ?? []) as Workout[])
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // Filtrer
  const now = new Date()
  const minDate = useMemo(() => {
    if (range === 'all') return null
    const d = new Date(now)
    const map: Record<Exclude<RangeKey,'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }
    d.setDate(d.getDate() - map[range as Exclude<RangeKey,'all'>])
    return d
  }, [range, now])

  const filtered = useMemo(() => {
    if (!minDate) return workouts
    return workouts.filter(w => {
      const t = w.created_at ? new Date(w.created_at) : null
      return t ? t >= minDate : false
    })
  }, [workouts, minDate])

  // Aggreger
  const { totals, running, strength, byMonth } = useMemo(() => {
    const totals = {
      count: filtered.length,
      byType: { løping: 0, styrke: 0, annet: 0 } as Record<WorkoutType, number>,
      firstDate: '' as string | null,
      lastDate: '' as string | null,
    }
    const running = { sessions: 0, totalKm: 0, totalSec: 0, avgKm: 0, avgPaceSec: 0, zones: {} as Record<number, number> }
    const strength = { sessions: 0, totalSets: 0, totalReps: 0, totalVolume: 0, topExercises: {} as Record<string, { volume: number; sets: number; reps: number }> }
    const byMonth = new Map<string, { count: number; km: number; sec: number; volume: number }>()

    if (filtered.length > 0) {
      totals.firstDate = filtered[filtered.length - 1]?.created_at ?? null
      totals.lastDate = filtered[0]?.created_at ?? null
    }

    for (const w of filtered) {
      totals.byType[w.type]++
      const mk = monthKey(w.created_at)
      if (!byMonth.has(mk)) byMonth.set(mk, { count: 0, km: 0, sec: 0, volume: 0 })
      const bucket = byMonth.get(mk)!

      if (w.type === 'løping') {
        running.sessions++
        const km = Number(w.distance ?? 0)
        const sec = parseHms(w.total_time)
        running.totalKm += km
        running.totalSec += sec
        if (w.zone != null) running.zones[w.zone] = (running.zones[w.zone] ?? 0) + 1
        bucket.count += 1; bucket.km += km; bucket.sec += sec
      } else if (w.type === 'styrke') {
        strength.sessions++
        const exs = w.strength_exercises ?? []
        for (const ex of exs) {
          strength.totalSets += ex.sets
          strength.totalReps += ex.sets * ex.reps
          const vol = ex.sets * ex.reps * ex.weight
          strength.totalVolume += vol
          const key = ex.exercise
          if (!strength.topExercises[key]) strength.topExercises[key] = { volume: 0, sets: 0, reps: 0 }
          strength.topExercises[key].volume += vol; strength.topExercises[key].sets += ex.sets; strength.topExercises[key].reps += ex.sets * ex.reps
          byMonth.get(mk)!.volume += vol
        }
        bucket.count += 1
      } else { bucket.count += 1 }
    }

    running.avgKm = running.sessions > 0 ? running.totalKm / running.sessions : 0
    running.avgPaceSec = running.totalKm > 0 ? running.totalSec / running.totalKm : 0
    return { totals, running, strength, byMonth }
  }, [filtered])

  const topStrengthList = useMemo(() => {
    const entries = Object.entries(strength.topExercises).map(([name, v]) => ({ name, ...v }))
    entries.sort((a, b) => b.volume - a.volume)
    return entries.slice(0, 5)
  }, [strength.topExercises])

  if (loading) return <div className="p-6">Laster inn statistikk…</div>
  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-3 sm:p-6">
        <Card><CardHeader><CardTitle>Kunne ikke hente data</CardTitle></CardHeader><CardContent><p className="text-sm text-red-600">{error}</p></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Statistikk</h1>
        <div className="flex flex-wrap gap-2">
          <RangeButton active={range === '7d'} onClick={() => setRange('7d')}>7 dager</RangeButton>
          <RangeButton active={range === '30d'} onClick={() => setRange('30d')}>30 dager</RangeButton>
          <RangeButton active={range === '90d'} onClick={() => setRange('90d')}>90 dager</RangeButton>
          <RangeButton active={range === 'all'} onClick={() => setRange('all')}>Hele tiden</RangeButton>
        </div>
      </div>

      {/* Totals */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Antall økter" value={totals.count} hint={`${totals.byType['løping']} løping • ${totals.byType['styrke']} styrke • ${totals.byType['annet']} annet`} />
          <StatCard label="Løpsdistanse" value={`${running.totalKm.toFixed(1)} km`} hint={running.sessions ? `${running.sessions} løpeøkter` : '—'} />
          <StatCard label="Løpstid" value={formatDuration(running.totalSec)} hint={running.totalKm > 0 ? `Snittfart ${formatPace(running.avgPaceSec)}` : '—'} />
          <StatCard label="Styrkevolum" value={`${Math.round(strength.totalVolume).toLocaleString('no-NO')} kg`} hint={`${strength.totalSets} sett • ${strength.totalReps} reps`} />
        </div>
        {totals.firstDate && totals.lastDate ? (
          <p className="text-xs text-muted-foreground mt-2">
            Periode: {new Date(totals.firstDate).toLocaleDateString('no-NO')} – {new Date(totals.lastDate).toLocaleDateString('no-NO')}
          </p>
        ) : null}
      </section>

      {/* Running */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Løping</h2>
        <Card><CardContent className="p-4">
          {running.sessions === 0 ? <p className="text-sm text-muted-foreground">Ingen løpeøkter i valgt periode.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Snitt pr økt" value={`${running.avgKm.toFixed(2)} km`} />
              <StatCard label="Total tid" value={formatDuration(running.totalSec)} />
              <StatCard label="Snittfart" value={formatPace(running.avgPaceSec)} />
            </div>
          )}
          {Object.keys(running.zones).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Sonefordeling</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(running.zones).sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([zone, count]) => (
                    <span key={zone} className="text-xs bg-muted px-2 py-1 rounded-full">Sone {zone}: {count}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent></Card>
      </section>

      {/* Strength */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Styrke</h2>
        <Card><CardContent className="p-4">
          {strength.sessions === 0 ? <p className="text-sm text-muted-foreground">Ingen styrkeøkter i valgt periode.</p> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <StatCard label="Økter" value={strength.sessions} />
                <StatCard label="Sett / Reps" value={`${strength.totalSets} / ${strength.totalReps}`} />
                <StatCard label="Totalt volum" value={`${Math.round(strength.totalVolume).toLocaleString('no-NO')} kg`} />
              </div>
              <h3 className="text-sm font-medium mb-2">Toppe øvelser (volum)</h3>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {topStrengthList.map(e => (
                  <li key={e.name}><span className="font-medium">{e.name}</span> – {Math.round(e.volume).toLocaleString('no-NO')} kg • {e.sets} sett • {e.reps} reps</li>
                ))}
              </ul>
            </>
          )}
        </CardContent></Card>
      </section>

      {/* Monthly */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Per måned</h2>
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 sm:p-3">Måned</th>
                  <th className="text-right p-2 sm:p-3">Økter</th>
                  <th className="text-right p-2 sm:p-3">Km løp</th>
                  <th className="text-right p-2 sm:p-3">Løpstid</th>
                  <th className="text-right p-2 sm:p-3">Styrkevolum</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byMonth.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([mk, v]) => (
                  <tr key={mk} className="border-b last:border-b-0">
                    <td className="p-2 sm:p-3">{mk}</td>
                    <td className="p-2 sm:p-3 text-right">{v.count}</td>
                    <td className="p-2 sm:p-3 text-right">{v.km.toFixed(1)}</td>
                    <td className="p-2 sm:p-3 text-right">{formatDuration(v.sec)}</td>
                    <td className="p-2 sm:p-3 text-right">{Math.round(v.volume).toLocaleString('no-NO')} kg</td>
                  </tr>
                ))}
                {byMonth.size === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Ingen data i valgt periode.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </section>

      {/* Recent workouts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Siste økter</h2>
        <div className="space-y-3">
          {filtered.slice(0, 10).map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">{w.title}</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-muted-foreground">{w.created_at ? new Date(w.created_at).toLocaleDateString('no-NO') : ''}</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{w.type}</span>
                </div>
                {w.type === 'løping' && <p className="mt-2">{w.distance ?? 0} km • {w.zone != null ? `Sone ${w.zone} • ` : ''}Tid {w.total_time ?? '-'}</p>}
                {w.type === 'styrke' && w.strength_exercises && (
                  <ul className="mt-2 list-disc pl-5 space-y-1">{w.strength_exercises.map((ex, i) => (
                    <li key={i}>{ex.exercise} ({ex.category}): {ex.sets} × {ex.reps} @ {ex.weight}kg • RPE {ex.rpe}</li>
                  ))}</ul>
                )}
                {w.type === 'annet' && w.description ? <p className="mt-2">{w.description}</p> : null}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">Ingen økter å vise i valgt periode.</CardContent></Card>}
        </div>
      </section>
    </div>
  )
}

function RangeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button variant={active ? 'default' : 'secondary'} size="sm" onClick={onClick} className="rounded-full">{children}</Button>
}
