'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import Login from './Login'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        setUser(session?.user ?? null)
        setChecking(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (mounted) setUser(session?.user ?? null)
      }
    )

    init()
    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err: any) {
      setError(err?.message ?? 'Kunne ikke logge ut')
    } finally {
      setLoading(false)
    }
  }

  return (
    <nav className="bg-gray-900 text-white shadow px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
      {/* Venstre side */}
      <div className="flex gap-4 items-center mr-auto">
        <Link href="/" className="font-bold text-lg">TankArmy</Link>
        {user && (
          <>
            <Link href="/workouts" className="hover:underline">Økter</Link>
            <Link href="/stats" className="hover:underline">Statistikk</Link>
          </>
        )}
      </div>

      {/* Høyre side */}
      <div className="ml-auto flex gap-3 items-center flex-wrap">
        {checking ? (
          <div className="h-8 w-28 rounded bg-gray-800 animate-pulse" />
        ) : user ? (
          <>
            <Link href="/profile" className="hover:underline text-sm" prefetch>
              Min profil
            </Link>
            <Link href="/settings" className="hover:underline text-sm" prefetch>
              Innstillinger
            </Link>
            <Link
              href="/workouts/new"
              className="bg-green-600 hover:bg-green-700 rounded px-3 py-1 text-sm"
            >
              ➕ Ny økt
            </Link>
            <span className="text-sm hidden sm:inline">Hei, {user.email}</span>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded px-3 py-1 text-sm"
            >
              {loading ? 'Logger ut…' : 'Logg ut'}
            </button>
            {error && <span className="ml-2 text-xs text-red-400">{error}</span>}
          </>
        ) : (
          <Login />
        )}
      </div>
    </nav>
  )
}
