'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

export default function NewWorkoutQuickPage() {
  const router = useRouter()

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
  const [stayOnPage, setStayOnPage] = useState(true) // Hurtig-innlegging av flere på rad

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

  const resetForm = () => {
    setTitle('')
    setType('løping')
    setDistance(undefined)
    setTotalTime('')
    setZone(undefined)
    setDescription('')
    setStrengthExercises([{ exercise: '', category: '', sets: 0, reps: 0, weight: 0, rpe: 0 }])
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingen bruker innlogget.')

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

      const { error } = await supabase.from('workouts').insert([newWorkout])
      if (error) throw error

      if (stayOnPage) {
        resetForm()
      } else {
        router.push('/workouts')
      }
    } catch (err: any) {
      alert(err.message ?? 'Noe gikk galt ved lagring.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Hurtig: ny treningsøkt</h1>

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

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stayOnPage}
              onChange={(e) => setStayOnPage(e.target.checked)}
            />
            Bli på siden etter lagring (hurtig-innlegging)
          </label>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/workouts')}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Lagrer...' : 'Legg til økt'}
            </Button>
          </div>
        </div>
      </form>
    </main>
  )
}
