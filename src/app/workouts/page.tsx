'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Types
type StrengthExercise = {
  exercise: string
  category: string
  sets: number
  reps: number
  weight: number
  rpe: number
}

type Workout = {
  id: string
  title: string
  user_id: string
  type: 'løping' | 'styrke' | 'annet'
  distance?: number | null
  zone?: number | null
  total_time?: string | null
  strength_exercises?: StrengthExercise[] | null
  description?: string | null
  created_at?: string
}

type NewWorkout = {
  title: string
  user_id: string
  type: 'løping' | 'styrke' | 'annet'
  distance?: number
  zone?: number
  total_time?: string
  strength_exercises?: StrengthExercise[]
  description?: string
}

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'løping' | 'styrke' | 'annet'>('løping')

  // Løping
  const [distance, setDistance] = useState<number | undefined>()
  const [totalTime, setTotalTime] = useState<string>('') // hh:mm:ss
  const [zone, setZone] = useState<number | undefined>()

  // Annet
  const [description, setDescription] = useState('')

  // Styrke
  const [strengthExercises, setStrengthExercises] = useState<StrengthExercise[]>([
    { exercise: '', category: '', sets: 0, reps: 0, weight: 0, rpe: 0 },
  ])

  const [loading, setLoading] = useState(false)

  // === Helpers ===
  const calculatePace = (time: string, distanceKm: number) => {
    if (!distanceKm || distanceKm <= 0) return null
    const [h = 0, m = 0, s = 0] = time.split(':').map((n) => Number(n) || 0)
    const totalSeconds = h * 3600 + m * 60 + s
    if (totalSeconds <= 0) return null
    const paceSec = totalSeconds / distanceKm
    const mm = Math.floor(paceSec / 60)
    const ss = Math.round(paceSec % 60).toString().padStart(2, '0')
    return `${mm}:${ss} min/km`
  }

  const calculateSpeed = (time: string, distanceKm: number) => {
    if (!distanceKm || distanceKm <= 0) return null
    const [h = 0, m = 0, s = 0] = time.split(':').map((n) => Number(n) || 0)
    const hours = (h * 3600 + m * 60 + s) / 3600
    if (hours <= 0) return null
    return (distanceKm / hours).toFixed(1)
  }

  const formatTimeVerbose = (time: string) => {
    const [h = 0, m = 0, s = 0] = time.split(':').map((n) => Number(n) || 0)
    const hourText = h > 0 ? `${h} time${h > 1 ? 'r' : ''}` : ''
    const minuteText = m > 0 ? `${m} min` : ''
    const secondText = s > 0 ? `${s} sek` : ''
    return [hourText, minuteText, secondText].filter(Boolean).join(', ').replace(/,([^,]*)$/, ' og$1')
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Ukjent dato'
    const date = new Date(dateString)
    return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // === Hent økter ===
  const fetchWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Feil ved henting:', error)
      } else {
        setWorkouts(data ?? [])
      }
    } catch (err) {
      console.error('Uventet feil ved henting:', err)
    }
  }

  useEffect(() => { fetchWorkouts() }, [])

  // === Legg til ny økt ===
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const cleanedStrength =
        type === 'styrke'
          ? strengthExercises.filter((ex) => ex.exercise.trim() !== '')
          : []

      const newWorkout: NewWorkout = {
        title: title.trim(),
        user_id: user.id,
        type,
        ...(type === 'løping' && distance !== undefined && totalTime && zone !== undefined
          ? { distance, total_time: totalTime, zone }
          : {}),
        ...(type === 'styrke' && cleanedStrength.length > 0
          ? { strength_exercises: cleanedStrength }
          : {}),
        ...(type === 'annet' && description.trim()
          ? { description: description.trim() }
          : {}),
      }

      const { data, error } = await supabase.from('workouts').insert([newWorkout]).select()
      if (error) {
        console.error('Feil ved innsending:', error)
      } else if (data && data.length > 0) {
        setWorkouts((prev) => [data[0] as Workout, ...prev])
        // Nullstill felter
        setTitle('')
        setDistance(undefined)
        setTotalTime('')
        setZone(undefined)
        setDescription('')
        setStrengthExercises([{ exercise: '', category: '', sets: 0, reps: 0, weight: 0, rpe: 0 }])
        setType('løping')
      }
    } catch (err) {
      console.error('Uventet feil ved innsending:', err)
    } finally {
      setLoading(false)
    }
  }

  // === Slett økt ===
  const deleteWorkout = async (id: string) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (!error) {
      setWorkouts((prev) => prev.filter((w) => w.id !== id))
    } else {
      console.error('Feil ved sletting:', error)
    }
  }

  // === Dynamiske styrke-felt ===
  const numericFields = new Set<keyof StrengthExercise>(['sets', 'reps', 'weight', 'rpe'])

  const handleStrengthChange = (
    index: number,
    field: keyof StrengthExercise,
    value: string | number,
  ) => {
    setStrengthExercises((prev) => {
      const next = [...prev]
      const current = { ...next[index] }

      if (numericFields.has(field)) {
        const num = value === '' ? 0 : Number(value)
        ;(current as any)[field] = Number.isFinite(num) ? num : 0
      } else {
        ;(current as any)[field] = String(value)
      }

      next[index] = current
      return next
    })
  }

  const addStrengthField = () => {
    setStrengthExercises((prev) => [
      ...prev,
      { exercise: '', category: '', sets: 0, reps: 0, weight: 0, rpe: 0 },
    ])
  }

  const removeStrengthField = (index: number) => {
    setStrengthExercises((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dine treningsøkter</h1>

      {/* Skjema for ny økt */}
      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2">
        {/* Navn */}
        <input
          type="text"
          placeholder="Navn på økt"
          className="border px-3 py-2 rounded w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Type */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="border px-3 py-2 rounded"
        >
          <option value="løping">🏃 Løping</option>
          <option value="styrke">🏋️ Styrke</option>
          <option value="annet">🧘 Annet</option>
        </select>

        {/* Løping-felter */}
        {type === 'løping' && (
          <>
            <input
              type="number"
              step={0.01}
              placeholder="Lengde (km)"
              className="border px-3 py-2 rounded w-full"
              value={distance ?? ''}
              onChange={(e) => setDistance(e.target.value ? parseFloat(e.target.value) : undefined)}
              required
            />

            <input
              type="time"
              step={1}
              className="border px-3 py-2 rounded w-full"
              value={totalTime}
              onChange={(e) => setTotalTime(e.target.value)}
              required
            />

            <select
              value={zone ?? ''}
              onChange={(e) => setZone(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="border px-3 py-2 rounded"
              required
            >
              <option value="">Velg sone</option>
              {[1, 2, 3, 4, 5].map((z) => (
                <option key={z} value={z}>
                  Sone {z}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Styrke-felter */}
        {type === 'styrke' && (
          <div className="space-y-2">
            <label className="font-medium text-sm">Styrkeøvelser:</label>
            {strengthExercises.map((ex, i) => (
              <div key={i} className="border p-3 rounded space-y-2">
                <input
                  type="text"
                  placeholder="Øvelse"
                  className="border px-3 py-2 rounded w-full"
                  value={ex.exercise}
                  onChange={(e) => handleStrengthChange(i, 'exercise', e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Kategori (f.eks. benk, mark, knebøy)"
                  className="border px-3 py-2 rounded w-full"
                  value={ex.category}
                  onChange={(e) => handleStrengthChange(i, 'category', e.target.value)}
                />

                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Sett"
                    className="border px-3 py-2 rounded w-1/3"
                    value={ex.sets === 0 ? '' : ex.sets}
                    onChange={(e) => handleStrengthChange(i, 'sets', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Reps"
                    className="border px-3 py-2 rounded w-1/3"
                    value={ex.reps === 0 ? '' : ex.reps}
                    onChange={(e) => handleStrengthChange(i, 'reps', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Vekt (kg)"
                    className="border px-3 py-2 rounded w-1/3"
                    value={ex.weight === 0 ? '' : ex.weight}
                    onChange={(e) => handleStrengthChange(i, 'weight', e.target.value)}
                  />
                </div>

                <input
                  type="number"
                  placeholder="RPE (1-10)"
                  min={1}
                  max={10}
                  className="border px-3 py-2 rounded w-full"
                  value={ex.rpe === 0 ? '' : ex.rpe}
                  onChange={(e) => handleStrengthChange(i, 'rpe', e.target.value)}
                />

                {strengthExercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStrengthField(i)}
                    className="text-red-600 text-sm"
                  >
                    ❌ Fjern øvelse
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addStrengthField}
              className="text-blue-600 text-sm"
            >
              + Legg til øvelse
            </button>
          </div>
        )}

        {/* Annet-felt */}
        {type === 'annet' && (
          <textarea
            placeholder="Beskrivelse (valgfritt)"
            className="border px-3 py-2 rounded w-full min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}

        <Button type="submit" disabled={loading}>
          {loading ? 'Lagrer...' : 'Legg til økt'}
        </Button>
      </form>

      {/* Liste over økter */}
      <div className="space-y-4">
        {workouts.map((w) => {
          const pace =
            w.type === 'løping' && w.distance && w.total_time
              ? calculatePace(w.total_time, Number(w.distance))
              : null
          const speed =
            w.type === 'løping' && w.distance && w.total_time
              ? calculateSpeed(w.total_time, Number(w.distance))
              : null

          const icon = w.type === 'løping' ? '🏃 ' : w.type === 'styrke' ? '🏋️ ' : '🧘 '

          return (
            <Card key={w.id}>
              <CardHeader className="flex justify-between items-center">
                <CardTitle>
                  {icon}{w.title}
                </CardTitle>
                <button
                  onClick={() => deleteWorkout(w.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  🗑️ Slett
                </button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{formatDate(w.created_at)}</p>

                {w.type === 'løping' && (
                  <div className="mt-2 text-sm">
                    <p><strong>Lengde:</strong> {w.distance ?? '-'} km</p>
                    <p><strong>Total tid:</strong> {w.total_time ? formatTimeVerbose(String(w.total_time)) : '-'}</p>
                    {speed && <p><strong>Snittfart:</strong> {speed} km/t</p>}
                    {pace && <p><strong>Pace:</strong> {pace}</p>}
                    <p><strong>Sone:</strong> {w.zone ?? '-'}</p>
                  </div>
                )}

                {w.type === 'styrke' && Array.isArray(w.strength_exercises) && (
                  <div className="mt-2 text-sm space-y-2">
                    <strong>Øvelser:</strong>
                    <ul className="list-disc list-inside">
                      {w.strength_exercises.map((ex, i) => (
                        <li key={i}>
                          <strong>{ex.exercise}</strong> ({ex.category || 'Ukjent'}) – {ex.sets} x {ex.reps} – {ex.weight} kg – RPE {ex.rpe}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {w.type === 'annet' && (
                  <div className="mt-2 text-sm">
                    {w.description ? (
                      <p><strong>Beskrivelse:</strong> {w.description}</p>
                    ) : (
                      <p className="text-muted-foreground">Ingen beskrivelse.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {workouts.length === 0 && (
          <p className="text-muted-foreground text-center">
            Ingen økter enda. Legg til en ny!
          </p>
        )}
      </div>
    </main>
  )
}
