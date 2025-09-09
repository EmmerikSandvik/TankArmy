'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SearchUsers from '@/components/SearchUsers'

// Types
type Workout = {
  id: string
  title: string
  user_id: string
  type: 'løping' | 'styrke' | 'annet' | string
  created_at?: string
}

type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  likes_count?: number
  comments_count?: number
  liked_by_me?: boolean
  // ⬅️ Nye felter for forfatter
  author_username?: string | null
  author_avatar_url?: string | null
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [feedMode, setFeedMode] = useState<'network' | 'mine'>('network')

  const [stats, setStats] = useState({
    total: 0,
    week: 0,
    løping: 0,
    styrke: 0,
    annet: 0,
  })

  // === Sjekk session ===
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (err) {
        console.warn('Auth-feil:', err)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // === Hent økter + poster + enkle stats ===
  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      // Siste 8 av MINE økter (feed for trening)
      const { data: recent } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)
      setWorkouts(recent || [])

      // Statistikk (min)
      const { count: total } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: week } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo)

      const [r1, r2, r3] = await Promise.all([
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'løping'),
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'styrke'),
        supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'annet'),
      ])

      setStats({
        total: total ?? 0,
        week: week ?? 0,
        løping: r1.count ?? 0,
        styrke: r2.count ?? 0,
        annet: r3.count ?? 0,
      })

      // Innlegg-feed: nettverk (meg + de jeg følger)
      const ids = await getNetworkUserIds(user.id)
      const postsWithMeta = await loadPostsWithMetaForIds(ids, 20)
      setPosts(postsWithMeta)
    }

    fetchAll()
  }, [user])

  // === hjelper: hvem følger jeg? (returnerer [meg, ...deJegFølger]) ===
  async function getNetworkUserIds(myId: string): Promise<string[]> {
    const { data: rows, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', myId)

    if (error) console.warn('Kunne ikke hente follows', error)
    const followings = (rows ?? []).map(r => r.following_id)
    return Array.from(new Set([myId, ...followings]))
  }

  // === hjelper: last innlegg for et sett med user_ids ===
  async function loadPostsWithMetaForIds(userIds: string[], limit = 20): Promise<Post[]> {
    if (!userIds.length) return []

    const { data: rawPosts } = await supabase
      .from('posts')
      .select('id, user_id, content, image_url, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    const myId = (await supabase.auth.getUser()).data.user?.id ?? null
    const postList = rawPosts ?? []

    // ⬅️ Hent forfatter-profiler i én batch
    const authorIds = Array.from(new Set(postList.map(p => p.user_id)))
    let authorMap: Record<string, { username: string | null; avatar_url: string | null }> = {}
    if (authorIds.length) {
      const { data: authors } = await supabase
        .from('public_profiles')
        .select('id, username, avatar_url')
        .in('id', authorIds)
      for (const a of authors ?? []) {
        authorMap[a.id] = { username: a.username, avatar_url: a.avatar_url }
      }
    }

    // Hent likes/kommentar-tall + om jeg har likt
    const result: Post[] = []
    for (const p of postList) {
      const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
        supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
      ])

      let likedByMe = false
      if (myId) {
        const { data: likeRow } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', p.id)
          .eq('user_id', myId)
          .maybeSingle()
        likedByMe = !!likeRow
      }

      result.push({
        ...p,
        likes_count: likesCount ?? 0,
        comments_count: commentsCount ?? 0,
        liked_by_me: likedByMe,
        author_username: authorMap[p.user_id]?.username ?? null,       // ⬅️
        author_avatar_url: authorMap[p.user_id]?.avatar_url ?? null,  // ⬅️
      })
    }

    return result
  }

  // === helpers ===
  const Greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 6) return 'Nattugle, '
    if (hour < 10) return 'God morgen, '
    if (hour < 14) return 'God dag, '
    if (hour < 18) return 'God ettermiddag, '
    return 'God kveld, '
  }, [])

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '')

  // === Lasteskjerm / auth ===
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center text-muted-foreground">Laster dashboard…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('/assets/Rambo-First-Blood.webp')" }}
      >
        <div className="bg-white/80 p-6 rounded-2xl shadow-xl w-full max-w-md">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Logg inn</CardTitle>
            </CardHeader>
            <CardContent>
              <AuthForm />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // === UI ===
  return (
    <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Topp */}
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {Greeting}{user.email?.split('@')[0] || 'athlete'}
          </h1>
          <p className="text-sm text-muted-foreground">Universelt hoveddash – alt på ett sted.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/workouts/new">
            <Button className="bg-green-600 hover:bg-green-700">➕ Ny økt</Button>
          </Link>
          <Link href="/stats">
            <Button variant="secondary">📈 Stats</Button>
          </Link>
        </div>
      </section>

      {/* Søk etter brukere */}
      <section>
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Finn brukere</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SearchUsers
              placeholder="Søk etter brukere…"
              onResultClickHref={(id) => `/u/${id}`}
            />
          </CardContent>
        </Card>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Totalt</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Denne uka</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.week}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">🏃 Løping</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.løping}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">🏋️ Styrke</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.styrke}</CardContent>
        </Card>
      </section>

      {/* Hurtigknapper */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/workouts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-base">📓 Alle økter</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Se/filtrer historikk</CardContent>
          </Card>
        </Link>
        <Link href="/workouts/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-base">⚡ Rask registrering</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Legg til på 10 sek</CardContent>
          </Card>
        </Link>
        <Link href="/stats">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-base">📈 Statistikk</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">KPIer og grafer</CardContent>
          </Card>
        </Link>
        <Link href="/profile">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-base">👤 Profil</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Innstillinger & innlegg</CardContent>
          </Card>
        </Link>
      </section>

      {/* Siste økter (mine) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Siste økter</h2>
          <Link href="/workouts"><Button variant="ghost">Se alle →</Button></Link>
        </div>
        {workouts.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            Ingen økter registrert ennå. Trykk «Ny økt» for å komme i gang.
          </CardContent></Card>
        ) : (
          <ul className="space-y-2">
            {workouts.map((w) => (
              <li key={w.id} className="border rounded-md bg-white px-3 py-2 flex items-center justify-between">
                <div className="truncate">
                  <span className="mr-2">
                    {w.type === 'løping' && '🏃'}
                    {w.type === 'styrke' && '🏋️'}
                    {w.type === 'annet' && '🧘'}
                    {!['løping','styrke','annet'].includes(w.type) && '📌'}
                  </span>
                  <span className="font-semibold">{w.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{fmt(w.created_at)}</span>
                </div>
                <Link href={`/workouts/${w.id}`} className="shrink-0">
                  <Button variant="secondary" size="sm">Åpne</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Innlegg-feed (nettverk eller mine) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">
            {feedMode === 'network' ? 'Feed fra nettverket ditt' : 'Dine siste innlegg'}
          </h2>
          <div className="flex gap-2">
            <Button
              variant={feedMode === 'network' ? 'default' : 'outline'}
              size="sm"
              onClick={async () => {
                setFeedMode('network')
                if (user) {
                  const ids = await getNetworkUserIds(user.id)
                  const data = await loadPostsWithMetaForIds(ids, 20)
                  setPosts(data)
                }
              }}
            >
              Nettverk
            </Button>
            <Button
              variant={feedMode === 'mine' ? 'default' : 'outline'}
              size="sm"
              onClick={async () => {
                setFeedMode('mine')
                if (user) {
                  const data = await loadPostsWithMetaForIds([user.id], 20)
                  setPosts(data)
                }
              }}
            >
              Mine
            </Button>
            <Link href="/profile"><Button variant="ghost">Til profilen →</Button></Link>
          </div>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {feedMode === 'network'
                ? 'Ingen innlegg fra deg eller de du følger ennå.'
                : 'Du har ikke postet noe ennå. Gå til «Profil» for å publisere ditt første innlegg.'}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} me={user.id} onChanged={refreshSinglePost} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )

  // === oppdater meta for ett postkort ===
  async function refreshSinglePost(postId: string) {
    const myId = (await supabase.auth.getUser()).data.user?.id ?? null
    const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
      supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    ])
    let likedByMe = false
    if (myId) {
      const { data: likeRow } = await supabase
        .from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', myId).maybeSingle()
      likedByMe = !!likeRow
    }
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      likes_count: likesCount ?? 0,
      comments_count: commentsCount ?? 0,
      liked_by_me: likedByMe,
    } : p))
  }
}

/** Enkel Post-kort: viser forfatter + like + kommenter */
function PostCard({
  post,
  me,
  onChanged,
}: {
  post: Post
  me: string
  onChanged: (postId: string) => Promise<void>
}) {
  const [liked, setLiked] = useState(!!post.liked_by_me)
  const [count, setCount] = useState(post.likes_count ?? 0)
  const [comments, setComments] = useState<
    { id: string; content: string; created_at: string; user_id: string; username: string | null; avatar_url: string | null }[]
  >([])
  const [commentValue, setCommentValue] = useState('')
  const [busyLike, setBusyLike] = useState(false)
  const [busyComment, setBusyComment] = useState(false)

  useEffect(() => {
    setLiked(!!post.liked_by_me)
    setCount(post.likes_count ?? 0)
  }, [post.liked_by_me, post.likes_count])

  useEffect(() => {
    loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })

    const list = data ?? []
    const ids = Array.from(new Set(list.map(c => c.user_id)))
    let profiles: Record<string, { username: string | null; avatar_url: string | null }> = {}
    if (ids.length) {
      const { data: profs } = await supabase
        .from('public_profiles')
        .select('id, username, avatar_url')
        .in('id', ids)
      for (const p of profs ?? []) profiles[p.id] = { username: p.username, avatar_url: p.avatar_url }
    }
    setComments(list.map(c => ({
      ...c,
      username: profiles[c.user_id]?.username ?? null,
      avatar_url: profiles[c.user_id]?.avatar_url ?? null,
    })))
  }

  const toggleLike = async () => {
    setBusyLike(true)
    try {
      if (liked) {
        setLiked(false); setCount(c => c - 1)
        const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', me)
        if (error) { setLiked(true); setCount(c => c + 1) }
      } else {
        setLiked(true); setCount(c => c + 1)
        const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: me })
        if (error) { setLiked(false); setCount(c => c - 1) }
      }
      await onChanged(post.id)
    } finally {
      setBusyLike(false)
    }
  }

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentValue.trim()) return
    setBusyComment(true)
    try {
      const text = commentValue.trim()
      const { error } = await supabase.from('comments').insert({
        post_id: post.id, user_id: me, content: text
      })
      if (!error) {
        setCommentValue('')
        await loadComments()
        await onChanged(post.id)
      }
    } finally {
      setBusyComment(false)
    }
  }

  return (
    <li className="border rounded-md bg-white px-3 py-2">
      {/* ⬅️ Forfatter-header: avatar + navn (lenket til /u/[id]) + tidspunkt */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/u/${post.user_id}`} className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {post.author_avatar_url
              ? <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-xs text-gray-500">👤</div>
            }
          </div>
          <div className="leading-none">
            <div className="text-sm font-medium group-hover:underline">
              {post.author_username ?? 'Ukjent bruker'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(post.created_at).toLocaleString()}
            </div>
          </div>
        </Link>

        {/* (valgfritt) ekstra aksjoner kan ligge her */}
      </div>

      {/* Innhold */}
      <p className="mt-2 whitespace-pre-wrap text-sm">{post.content}</p>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="post" className="mt-2 rounded-lg w-full" />
      )}

      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" variant={liked ? 'default' : 'outline'} onClick={toggleLike} disabled={busyLike}>
          👍 {count}
        </Button>
        <div className="text-sm text-muted-foreground">Kommentarer ({comments.length})</div>
      </div>

      {/* Kommentarer */}
      <ul className="mt-2 space-y-3">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">Ingen kommentarer.</li>
        ) : comments.map(c => (
          <li key={c.id} className="flex gap-3">
            <Link href={`/u/${c.user_id}`} className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.avatar_url && <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />}
            </Link>
            <div className="min-w-0">
              <Link href={`/u/${c.user_id}`} className="text-sm font-medium hover:underline">
                {c.username ?? 'Anonym'}
              </Link>
              <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
              <div className="mt-1 whitespace-pre-wrap break-words">{c.content}</div>
            </div>
          </li>
        ))}
      </ul>

      {/* Ny kommentar */}
      <form onSubmit={sendComment} className="mt-3 flex gap-2">
        <input
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
          placeholder="Skriv en kommentar…"
          className="flex-1 rounded border px-3 py-2 bg-white text-black"
        />
        <Button type="submit" disabled={busyComment || !commentValue.trim()}>Kommenter</Button>
      </form>
    </li>
  )
}
