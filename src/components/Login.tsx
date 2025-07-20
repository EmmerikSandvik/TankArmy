'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  return (
    <form
      onSubmit={handleLogin}
       className="max-w-sm mx-auto mt-20 p-6 rounded-xl shadow space-y-4"
  style={{
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)'
  }}
>
      {/* Logo på toppen av boksen */}
      <div className="flex justify-center mb-4">
        <Image
          src="/assets/tank-svgrepo-com.svg"
          alt="Tank logo"
          width={80}
          height={40}
        />
      </div>

      <h2 className="text-xl font-semibold text-center">Logg inn</h2>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-post"
        className="w-full p-2 border rounded"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Passord"
        className="w-full p-2 border rounded"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
      >
        {loading ? 'Logger inn...' : 'Logg inn'}
      </button>
    </form>
  )
}
