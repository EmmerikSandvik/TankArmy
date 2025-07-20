'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    let result
    if (isLogin) {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({ email, password })
    }

    const { error } = result
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-20 p-6 bg-white rounded-xl shadow space-y-4"
    >
      <h2 className="text-xl font-semibold text-center">
        {isLogin ? 'Logg inn' : 'Registrer ny bruker'}
      </h2>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <input
        type="email"
        placeholder="E-post"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="password"
        placeholder="Passord"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
      >
        {loading ? 'Sender...' : isLogin ? 'Logg inn' : 'Registrer'}
      </button>

      <p className="text-sm text-center">
        {isLogin ? 'Har du ikke konto?' : 'Har du allerede en konto?'}{' '}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="underline text-blue-600"
        >
          {isLogin ? 'Registrer deg her' : 'Logg inn'}
        </button>
      </p>
    </form>
  )
}
