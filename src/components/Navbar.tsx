'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="bg-gray-900 text-white shadow px-6 py-3 flex justify-between items-center">
      <div className="flex gap-6 items-center">
        {/* Logo → alltid til dashboard (forsiden) */}
        <Link href="/" className="font-bold text-lg">TankArmy</Link>
        {user && (
          <>
            <Link href="/workouts" prefetch={false} className="hover:underline">Økter</Link>
            <Link href="/stats" className="hover:underline">Statistikk</Link>
          </>
        )}
      </div>
      {user && (
        <div className="flex gap-4 items-center">
          <Link href="/workouts/new">
            <Button className="bg-green-600 hover:bg-green-700 text-white text-sm">
              ➕ Ny økt
            </Button>
          </Link>
          <span className="text-sm hidden sm:inline">Hei, {user.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-600 px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Logg ut
          </button>
        </div>
      )}
    </nav>
  )
}
