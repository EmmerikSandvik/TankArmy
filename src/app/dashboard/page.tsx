'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import Link from 'next/link'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"

type Workout = {
  id: string
  title: string
  user_id: string
  type: string
  created_at?: string
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  // === Sjekk session ===
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error: any) {
        console.warn('Auth-feil:', error.message)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoading(false)
      }
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

  // === Hent treningsøkter ===
  useEffect(() => {
    if (!user) return
    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5) // Vis kun de siste 5
      if (error) {
        console.error('Feil ved henting:', error.message || error)
      } else {
        setWorkouts(data || [])
      }
    }
    fetchWorkouts()
  }, [user])

  // === Lasteskjerm ===
  if (loading) {
    return <div className="p-8 text-center">Laster...</div>
  }

  // === Hvis ikke innlogget ===
  if (!user) {
    return (
      <div
        className="min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('/assets/Rambo-First-Blood.webp')" }}
      >
        <div className="bg-white/80 p-6 rounded shadow">
          <AuthForm />
        </div>
      </div>
    )
  }

  // === Hvis innlogget ===
  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Ditt dashboard</h1>

      {/* Knapp til ny økt */}
      <div className="mb-6">
        <Link href="/workouts/new">
          <Button className="w-full bg-green-600 hover:bg-green-700">➕ Legg til ny økt</Button>
        </Link>
      </div>

      {/* Liste over siste økter */}
      <h2 className="text-xl font-semibold mb-2">Siste økter</h2>
      <ul className="space-y-2">
        {workouts.map((w) => (
          <li key={w.id} className="border bg-white px-3 py-2 rounded">
            <span className="font-bold">
              {w.type === 'løping' && '🏃 '}
              {w.type === 'styrke' && '🏋️ '}
              {w.type === 'boksing' && '🥊 '}
              {w.type === 'annet' && '🧘 '}
              {w.title}
            </span>
          </li>
        ))}

        {workouts.length === 0 && (
          <p className="text-gray-500">Ingen økter registrert ennå.</p>
        )}
      </ul>
    </main>
  )
}
