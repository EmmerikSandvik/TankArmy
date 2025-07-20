'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Workout = {
  id: string
  name: string
  date: string
}

export default function Home() {
  const [workouts, setWorkouts] = useState<Workout[]>([])

  useEffect(() => {
    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('Feil ved henting:', error)
      } else {
        setWorkouts(data || [])
      }
    }

    fetchWorkouts()
  }, [])

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dine treningsøkter</h1>
      <ul className="space-y-2">
        {workouts.map((w) => (
          <li key={w.id} className="p-3 border rounded">
            {w.name} – {w.date}
          </li>
        ))}
      </ul>
    </main>
  )
}
