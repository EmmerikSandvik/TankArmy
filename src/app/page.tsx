'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import Layout from '@/components/Layout'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

type Workout = {
  id: string
  title: string
  user_id: string
  type: string
  gps: string | null
  created_at?: string
}

// Ny type for innsetting
type NewWorkout = {
  title: string
  user_id: string
  type: string
  gps: string | null
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState('løping')

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth error:', error.message)
        if (error.message.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut()
          setUser(null)
          return
        }
      }

      setUser(session?.user ?? null)
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .returns<Workout[]>()
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Feil ved henting:', error.message || error)
      } else {
        setWorkouts(data || [])
      }
    }

    fetchWorkouts()
  }, [user])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle || !user) return

    const newWorkout: NewWorkout = {
      title: cleanTitle,
      user_id: user.id,
      type,
      gps: null
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert([newWorkout])
      .select()

    if (error) {
      console.error('Feil ved innsending:', error.message || error)
    } else {
      setWorkouts((prev) => [...(data || []), ...prev])
      setTitle('')
    }
  }

  if (!user) {
    return (
      <Layout>
        <div
          className="min-h-screen bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: "url('/assets/Rambo-First-Blood.webp')" }}
        >
          <div className="bg-white/80 p-6 rounded shadow">
            <AuthForm />
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <main className="p-4 max-w-xl mx-auto">
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            setUser(null)
          }}
          className="mb-4 text-sm text-red-700 underline"
        >
          Logg ut
        </button>

        <h1 className="text-2xl font-bold mb-4">Dine treningsøkter</h1>

        <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Navn på økt"
            className="border px-3 py-2 rounded w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="løping">🏃 Løping</option>
            <option value="styrke">🏋️ Styrke</option>
            <option value="boksing">🥊 Boksing</option>
            <option value="annet">🧘 Annet</option>
          </select>

          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Legg til
          </button>
        </form>

        <ul className="space-y-2">
          {workouts.map((w) => (
            <li
              key={w.id}
              className="border bg-white px-3 py-2 rounded flex justify-between items-center"
            >
              <span className="font-bold text-black text-lg">
                {w.type === 'løping' && '🏃 Løping: '}
                {w.type === 'styrke' && '🏋️ Styrke: '}
                {w.type === 'boksing' && '🥊 Boksing: '}
                {w.type === 'annet' && '🧘 Annet: '}
                {w.title}
              </span>
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from('workouts')
                    .delete()
                    .eq('id', w.id)

                  if (error) {
                    console.error('Feil ved sletting:', error.message)
                    return
                  }

                  setWorkouts((prev) => prev.filter((item) => item.id !== w.id))
                }}
                className="text-red-600 hover:text-red-800 text-sm"
                aria-label={`Slett ${w.title}`}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </main>
    </Layout>
  )
}
