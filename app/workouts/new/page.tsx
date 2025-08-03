'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function NewWorkoutPage() {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('styrke')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ingen bruker innlogget.')

      const { error } = await supabase
        .from('workouts')
        .insert([{ title, type, user_id: user.id }])

      if (error) throw error
      router.push('/') // Tilbake til dashboard
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Legg til ny økt</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Tittel</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="styrke">Styrke</option>
            <option value="løping">Løping</option>
            <option value="boksing">Boksing</option>
            <option value="annet">Annet</option>
          </select>
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
          {loading ? 'Lagrer...' : 'Legg til økt'}
        </Button>
      </form>
    </main>
  )
}
