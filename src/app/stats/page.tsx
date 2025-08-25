'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type Workout = {
  id: string
  user_id: string
  title?: string | null
  type: 'løping' | 'styrke' | 'boksing' | 'annet'
  distance?: number | null
  total_time?: string | null // "HH:MM:SS"
  created_at: string
}

type SortKey =
  | 'date_desc'
  | 'date_asc'
  | 'longest_runs'
  | 'fastest_runs_kph'
  | 'fastest_pace_per_km'

export default function StatsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { setUser(null); setChecking(false); return }
      setUser(user)

      const { data, error } = await supabase
        .from('workouts')
        .select('id,user_id,title,type,distance,total_time,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!mounted) return
      if (error) setError(error.message)
      else setWorkouts((data ?? []) as Workout[])
      setChecking(false)
    }
    run()
    return () => { mounted = false }
  }, [])

  const total = workouts.length
  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts) m.set(w.type, (m.get(w.type) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [workouts])

  // Helpers
  const timeToSeconds = (hhmmss?: string | null) => {
    if (!hhmmss) return null
    const parts = hhmmss.split(':').map(n => Number(n) || 0)
    const [h=0,m=0,s=0] = parts
    const total = h*3600 + m*60 + s
    return total > 0 ? total : null
  }
  const speedKph = (w: Workout) => {
    if (w.type !== 'løping' || !w.distance || w.distance <= 0) return null
    const sec = timeToSeconds(w.total_time); if (!sec) return null
    const hours = sec / 3600
    return hours > 0 ? w.distance / hours : null
  }
  const paceSecPerKm = (w: Workout) => {
    if (w.type !== 'løping' || !w.distance || w.distance <= 0) return null
    const sec = timeToSeconds(w.total_time); if (!sec) return null
    return sec / w.distance // sek per km (lavere er bedre)
  }
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtPace = (secPerKm: number | null) => {
    if (secPerKm == null) return '-'
    const mm = Math.floor(secPerKm / 60)
    const ss = Math.round(secPerKm % 60).toString().padStart(2, '0')
    return `${mm}:${ss} min/km`
  }

  // Sortert liste (topp 10) basert på valgt key
  const sortedList = useMemo(() => {
    const copy = [...workouts]
    switch (sortKey) {
      case 'date_desc':
        copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        return copy.slice(0, 10)
      case 'date_asc':
        copy.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
        return copy.slice(0, 10)
      case 'longest_runs': {
        const runs = copy.filter(w => w.type === 'løping' && (w.distance ?? 0) > 0)
        runs.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0))
        return runs.slice(0, 10)
      }
      case 'fastest_runs_kph': {
        const runs = copy
          .map(w => ({ w, v: speedKph(w) }))
          .filter(x => x.v != null) as { w: Workout; v: number }[]
        runs.sort((a, b) => b.v - a.v)
        return runs.slice(0, 10).map(x => x.w)
      }
      case 'fastest_pace_per_km': {
        const runs = copy
          .map(w => ({ w, v: paceSecPerKm(w) }))
          .filter(x => x.v != null) as { w: Workout; v: number }[]
        runs.sort((a, b) => a.v - b.v) // lavest pace først = raskest
        return runs.slice(0, 10).map(x => x.w)
      }
      default:
        return copy.slice(0, 10)
    }
  }, [workouts, sortKey])

  // ⬇️ NYTT: grupper alt per måned (nyeste måned først, og økter i hver måned nyest først)
  const groupedByMonth = useMemo(() => {
    const buckets = new Map<string, Workout[]>()

    for (const w of workouts) {
      const d = new Date(w.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // "2025-08"
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(w)
    }

    const monthKeys = Array.from(buckets.keys()).sort((a, b) => b.localeCompare(a)) // nyeste først
    return monthKeys.map((key) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleDateString('no-NO', {
        month: 'long',
        year: 'numeric',
      })
      const list = buckets.get(key)!.sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      )
      return { key, label, list }
    })
  }, [workouts])

  if (checking) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-3" />
        <div className="h-24 bg-gray-200 rounded animate-pulse" />
      </main>
    )
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold">Statistikk</h1>
        <p className="text-gray-600 mt-2">Logg inn for å se statistikken.</p>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Statistikkene dine</h1>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </header>

      {/* Aggregater */}
      <section className="space-y-2">
        <div className="text-lg">
          <span className="font-semibold">Totalt antall økter:</span> {total}
        </div>
        <div>
          <div className="font-semibold mb-1">Antall per type (flest først):</div>
          {countsByType.length === 0 ? (
            <p className="text-sm text-gray-500">Ingen økter ennå.</p>
          ) : (
            <ul className="list-disc list-inside">
              {countsByType.map(([type, count]) => (
                <li key={type}>
                  {type} — <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Sortert topp-10 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm font-medium">Sorter etter:</label>
          <select
            id="sort"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="border px-3 py-2 rounded"
          >
            <option value="date_desc">Nyeste dato først</option>
            <option value="date_asc">Eldste dato først</option>
            <option value="longest_runs">Lengste løpeøkter (km)</option>
            <option value="fastest_runs_kph">Raskeste løpeøkter (km/t)</option>
            <option value="fastest_pace_per_km">Raskeste per km (min/km)</option>
          </select>
        </div>

        <ul className="divide-y rounded border">
          {sortedList.length === 0 ? (
            <li className="p-3 text-sm text-gray-500">Ingen økter å vise.</li>
          ) : (
            sortedList.map(w => {
              const speed = speedKph(w)
              const pace = paceSecPerKm(w)
              return (
                <li key={w.id} className="p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium">
                      {w.title || '(uten tittel)'} {w.type === 'løping' ? '🏃' : w.type === 'styrke' ? '🏋️' : w.type === 'boksing' ? '🥊' : '🧘'}
                    </div>
                    <div className="text-sm text-gray-500">{fmtDate(w.created_at)}</div>
                  </div>

                  {w.type === 'løping' && (
                    <div className="mt-1 text-sm text-gray-700 space-x-3">
                      <span><b>Dist:</b> {w.distance ?? '-'} km</span>
                      <span><b>Fart:</b> {speed ? `${speed.toFixed(1)} km/t` : '-'}</span>
                      <span><b>Pace:</b> {fmtPace(pace ?? null)}</span>
                    </div>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </section>

      {/* ⬇️ NY SEKSJON: Økter per måned */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Økter per måned</h2>
        {groupedByMonth.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen økter ennå.</p>
        ) : (
          groupedByMonth.map(({ key, label, list }) => (
            <div key={key} className="mt-2">
              <h3 className="text-lg font-semibold capitalize">{label}</h3>
              <ul className="divide-y rounded border mt-2">
                {list.map((w) => {
                  const speed = speedKph(w)
                  const pace = paceSecPerKm(w)
                  return (
                    <li key={w.id} className="p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-medium">
                          {w.title || '(uten tittel)'} {w.type === 'løping' ? '🏃' : w.type === 'styrke' ? '🏋️' : w.type === 'boksing' ? '🥊' : '🧘'}
                        </div>
                        <div className="text-sm text-gray-500">{fmtDate(w.created_at)}</div>
                      </div>

                      {w.type === 'løping' && (
                        <div className="mt-1 text-sm text-gray-700 space-x-3">
                          <span><b>Dist:</b> {w.distance ?? '-'} km</span>
                          <span><b>Fart:</b> {speed ? `${speed.toFixed(1)} km/t` : '-'}</span>
                          <span><b>Pace:</b> {fmtPace(pace ?? null)}</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </main>
  )
}
