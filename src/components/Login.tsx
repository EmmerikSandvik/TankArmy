import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

export default function LoginOverlay() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Kun Facebook OAuth
  const [oauthLoading, setOauthLoading] = useState<null | 'facebook'>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Sjekk e-posten din for å bekrefte kontoen.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('E-post for tilbakestilling er sendt.')
      }
    } catch (err: any) {
      setError(err.message ?? 'Noe gikk galt')
    } finally {
      setLoading(false)
    }
  }

  // === OAuth (kun Facebook) ===
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined

  const handleFacebookOAuth = async () => {
    setError('')
    setMessage('')
    setOauthLoading('facebook')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo },
      })
      if (error) throw error
      // Redirect skjer automatisk
    } catch (e: any) {
      setError(e?.message ?? 'Innlogging feilet')
    } finally {
      setOauthLoading(null)
    }
  }

  if (checking || user) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      {/* Bakgrunnsbilde */}
      <Image
        src="/assets/Rambo-First-Blood.webp"
        alt="Background"
        fill
        priority
        className="object-cover -z-10"
      />

      {/* Overlay */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm mx-auto p-6 rounded-xl shadow space-y-4 bg-white/90 backdrop-blur"
      >
        <h2 className="text-xl font-semibold text-center text-black">
          {mode === 'login'
            ? 'Logg inn'
            : mode === 'signup'
            ? 'Registrer deg'
            : 'Glemt passord'}
        </h2>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center">{message}</p>}

        {/* Facebook-knapp */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleFacebookOAuth}
            disabled={!!oauthLoading}
            className="w-full border rounded py-2 font-medium hover:bg-gray-50 flex items-center justify-center"
            aria-label="Logg inn med Facebook"
          >
            <Image
              src="/assets/facebook.png"
              alt="Facebook logo"
              width={24}
              height={24}
              className="inline-block"
            />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="h-px bg-gray-300 flex-1" />
          <span className="text-xs text-gray-600">eller</span>
          <div className="h-px bg-gray-300 flex-1" />
        </div>

        {/* E-post / passord */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="E-post"
          className="w-full p-2 border rounded text-black bg-white"
          required
        />

        {mode !== 'forgot' && (
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Passord"
            className="w-full p-2 border rounded text-black bg-white"
            required
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
        >
          {loading
            ? 'Laster...'
            : mode === 'login'
            ? 'Logg inn'
            : mode === 'signup'
            ? 'Registrer'
            : 'Send e-post'}
        </button>

        <div className="flex justify-between text-sm text-black">
          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="underline"
              >
                Ny bruker?
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="underline"
              >
                Glemt passord?
              </button>
            </>
          )}

          {mode === 'signup' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="underline"
            >
              Allerede bruker? Logg inn
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="underline"
            >
              Tilbake til innlogging
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
