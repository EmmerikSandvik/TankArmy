'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PublicProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
}

interface Props {
  placeholder?: string
  limit?: number
  onResultClickHref?: (id: string, username: string | null) => string
}

export default function SearchUsers({
  placeholder = 'Søk etter brukere…',
  limit = 10,
  onResultClickHref = (id, username) => `/u/${id}`,
}: Props) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PublicProfile[]>([])
  const [touched, setTouched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!touched) return
    if (!q.trim()) {
      setResults([])
      return
    }

    const run = async () => {
      setLoading(true)
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const term = q.trim()
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term)

      // Bygg spørring
      let query = supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .order('username', { ascending: true })
        .limit(limit)

      if (isUuid) {
        // Søk på id eksakt, eller username ilike
        query = query.or(`id.eq.${term},username.ilike.%${term}%`)
      } else {
        // Kun username ilike
        query = query.ilike('username', `%${term}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('[SearchUsers] supabase error:', error)
        setResults([])
      } else {
        setResults(data ?? [])
      }

      setLoading(false)
    }

    const t = setTimeout(run, 200) // enkel debounce
    return () => clearTimeout(t)
  }, [q, limit, touched])

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => {
          setTouched(true)
          setQ(e.target.value)
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2"
      />

      {loading && <div className="text-sm text-muted-foreground">Søker…</div>}

      {touched && !loading && results.length === 0 && q.trim() && (
        <div className="text-sm text-muted-foreground">Ingen treff</div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((u) => (
            <li key={u.id}>
              <Card>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="size-9 overflow-hidden rounded-full border">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.username ?? u.id}</div>
                    {u.bio && <div className="truncate text-xs text-muted-foreground">{u.bio}</div>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={onResultClickHref(u.id, u.username)}>Se profil</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
