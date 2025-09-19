// app/u/[id]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PublicProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
  created_at?: string | null
}

type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
}

type Workout = {
  id: string
  user_id: string
  type: string
  distance?: number | null
  total_time?: string | null
  created_at: string
}

type LikeState = Record<string, { count: number; liked: boolean }>

export default function UserProfilePage() {
  const { id } = useParams() as { id: string }
  return (
    <div key={id} className="w-full max-w-3xl mx-auto p-2 sm:p-4">
      <ProfileView idOrUsername={id} />
    </div>
  )
}

function ProfileView({ idOrUsername }: { idOrUsername: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [likes, setLikes] = useState<LikeState>({})
  const [hasMorePosts, setHasMorePosts] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [me, setMe] = useState<string | null>(null)

  const [followersCount, setFollowersCount] = useState<number>(0)
  const [followingCount, setFollowingCount] = useState<number>(0)

  type EdgeItem = { id: string; username: string | null; avatar_url: string | null; since: string }
  const pageSizeList = 15
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [followersPage, setFollowersPage] = useState(0)
  const [followingPage, setFollowingPage] = useState(0)
  const [followersHasMore, setFollowersHasMore] = useState(false)
  const [followingHasMore, setFollowingHasMore] = useState(false)
  const [followersList, setFollowersList] = useState<EdgeItem[]>([])
  const [followingList, setFollowingList] = useState<EdgeItem[]>([])
  const [listsBusy, setListsBusy] = useState(false)

  const [postPage, setPostPage] = useState(0)
  const pageSize = 10

  const stats = useMemo(() => {
    const totalSessions = workouts.length
    const totalDistance = workouts.reduce((sum, w) => sum + (w.distance ?? 0), 0)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const last7 = workouts.filter(w => new Date(w.created_at) >= cutoff).length
    return { totalSessions, totalDistance, last7 }
  }, [workouts])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: auth } = await supabase.auth.getUser()
        if (!cancelled) setMe(auth?.user?.id ?? null)

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio, created_at')
          .or(`id.eq.${idOrUsername},username.eq.${idOrUsername}`)
          .maybeSingle()

        if (profErr) throw profErr
        if (!prof) {
          if (!cancelled) {
            setProfile(null)
            setPosts([])
            setWorkouts([])
            setLikes({})
            setFollowersCount(0)
            setFollowingCount(0)
            setFollowersList([])
            setFollowingList([])
          }
          return
        }
        if (cancelled) return
        setProfile(prof)

        {
          const [{ count: followersC }, { count: followingC }] = await Promise.all([
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', prof.id),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', prof.id),
          ])
          if (!cancelled) {
            setFollowersCount(followersC ?? 0)
            setFollowingCount(followingC ?? 0)
          }
        }

        {
          const from = postPage * pageSize
          const to = from + pageSize
          const { data: postData, error: postErr } = await supabase
            .from('posts')
            .select('id, user_id, content, image_url, created_at')
            .eq('user_id', prof.id)
            .order('created_at', { ascending: false })
            .range(from, to)

          if (postErr) throw postErr
          if (cancelled) return

          const list = postData ?? []
          setHasMorePosts(list.length > pageSize)
          const visiblePosts = list.slice(0, pageSize)
          setPosts(visiblePosts)

          const ids = visiblePosts.map(p => p.id)
          const myId = (await supabase.auth.getUser()).data?.user?.id ?? null
          if (ids.length) {
            const { data: allLikes, error: likesErr } = await supabase
              .from('post_likes')
              .select('post_id, user_id')
              .in('post_id', ids)

            if (likesErr) throw likesErr

            const nextLikes: LikeState = {}
            for (const id of ids) nextLikes[id] = { count: 0, liked: false }
            for (const row of allLikes ?? []) {
              nextLikes[row.post_id].count++
              if (row.user_id === (myId ?? me)) nextLikes[row.post_id].liked = true
            }
            if (!cancelled) setLikes(nextLikes)
          } else {
            if (!cancelled) setLikes({})
          }
        }

        {
          const { data: workoutData, error: woErr } = await supabase
            .from('workouts')
            .select('id, user_id, type, distance, total_time, created_at')
            .eq('user_id', prof.id)
            .order('created_at', { ascending: false })

          if (woErr) throw woErr
          if (!cancelled) setWorkouts(workoutData ?? [])
        }

        if (!cancelled) {
          setFollowersList([])
          setFollowingList([])
          setFollowersPage(0)
          setFollowingPage(0)
          setFollowersHasMore(false)
          setFollowingHasMore(false)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Noe gikk galt')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [idOrUsername, postPage])

  const loadFollowersPage = async (page = 0) => {
    if (!profile) return
    setListsBusy(true)
    try {
      const from = page * pageSizeList
      const to = from + pageSizeList
      const { data: edges } = await supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', profile.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      const list = edges ?? []
      const hasMore = list.length > pageSizeList
      const slice = list.slice(0, pageSizeList)
      const ids = slice.map(e => e.follower_id)
      let users: PublicProfile[] = []
      if (ids.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        users = data ?? []
      }
      const mapped: EdgeItem[] = slice.map(e => {
        const u = users.find(x => x.id === e.follower_id)
        return { id: u?.id ?? e.follower_id, username: u?.username ?? null, avatar_url: u?.avatar_url ?? null, since: e.created_at }
      })
      setFollowersHasMore(hasMore)
      setFollowersList(mapped)
      setFollowersPage(page)
    } finally {
      setListsBusy(false)
    }
  }

  const loadFollowingPage = async (page = 0) => {
    if (!profile) return
    setListsBusy(true)
    try {
      const from = page * pageSizeList
      const to = from + pageSizeList
      const { data: edges } = await supabase
        .from('follows')
        .select('following_id, created_at')
        .eq('follower_id', profile.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      const list = edges ?? []
      const hasMore = list.length > pageSizeList
      const slice = list.slice(0, pageSizeList)
      const ids = slice.map(e => e.following_id)
      let users: PublicProfile[] = []
      if (ids.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        users = data ?? []
      }
      const mapped: EdgeItem[] = slice.map(e => {
        const u = users.find(x => x.id === e.following_id)
        return { id: u?.id ?? e.following_id, username: u?.username ?? null, avatar_url: u?.avatar_url ?? null, since: e.created_at }
      })
      setFollowingHasMore(hasMore)
      setFollowingList(mapped)
      setFollowingPage(page)
    } finally {
      setListsBusy(false)
    }
  }

  useEffect(() => {
    if (showFollowers && followersList.length === 0) loadFollowersPage(0)
  }, [showFollowers])
  useEffect(() => {
    if (showFollowing && followingList.length === 0) loadFollowingPage(0)
  }, [showFollowing])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Laster profil …</CardTitle>
          <CardDescription>Henter bruker, innlegg og statistikk</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 rounded-lg border" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Kunne ikke laste</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => location.reload()}>Prøv igjen</Button>
        </CardFooter>
      </Card>
    )
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fant ikke bruker</CardTitle>
          <CardDescription>Brukeren «{idOrUsername}» finnes ikke.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/">Til forsiden</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username ?? 'avatar'}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">
                Ingen
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <CardTitle className="text-xl">
              {profile.username ?? 'Ukjent bruker'}
            </CardTitle>
            <CardDescription>
              Med siden {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
            </CardDescription>

            <div className="mt-2 flex flex-wrap justify-center sm:justify-start items-center gap-2 text-sm">
              <Button
                variant="ghost"
                className="px-2 h-7"
                onClick={() => setShowFollowers((v) => !v)}
              >
                <span className="font-medium">{followersCount}</span>&nbsp;følgere
              </Button>
              <span className="hidden sm:inline text-muted-foreground">•</span>
              <Button
                variant="ghost"
                className="px-2 h-7"
                onClick={() => setShowFollowing((v) => !v)}
              >
                Følger&nbsp;<span className="font-medium">{followingCount}</span>
              </Button>
            </div>
          </div>

          <CardContent className="p-0 flex flex-wrap justify-center sm:justify-end gap-2">
            {me && profile.id !== me && (
              <FollowButton
                profileId={profile.id}
                onChange={(isFollowing) => {
                  setFollowersCount((c) => c + (isFollowing ? 1 : -1))
                }}
              />
            )}

            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${location.origin}/u/${profile.id}`)
                } catch {}
              }}
            >
              Kopier lenke
            </Button>

            <Button asChild variant="outline">
              <Link href={`/u/${profile.id}`}>Åpne</Link>
            </Button>
          </CardContent>
        </CardHeader>

        {profile.bio && (
          <CardContent>
            <p className="text-sm text-muted-foreground text-center sm:text-left">{profile.bio}</p>
          </CardContent>
        )}
      </Card>

      {/* Følgere */}
      {showFollowers && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Følgere</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" disabled={listsBusy || followersPage === 0} onClick={() => loadFollowersPage(Math.max(0, followersPage - 1))}>
                Forrige
              </Button>
              <Button size="sm" disabled={listsBusy || !followersHasMore} onClick={() => loadFollowersPage(followersPage + 1)}>
                Neste
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {followersList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen følgere ennå.</p>
            ) : (
              <ul className="space-y-3">
                {followersList.map(u => (
                  <li key={`${u.id}-${u.since}`} className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                    <div className="relative size-9 overflow-hidden rounded-full border">
                      {u.avatar_url ? (
                        <Image src={u.avatar_url} alt={u.username ?? 'avatar'} fill className="object-cover" sizes="36px" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link className="truncate font-medium hover:underline" href={`/u/${u.id}`}>
                        {u.username ?? u.id.slice(0, 8)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Siden {new Date(u.since).toLocaleDateString()}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                      <Link href={`/u/${u.id}`}>Se profil</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Følger */}
      {showFollowing && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Følger</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" disabled={listsBusy || followingPage === 0} onClick={() => loadFollowingPage(Math.max(0, followingPage - 1))}>
                Forrige
              </Button>
              <Button size="sm" disabled={listsBusy || !followingHasMore} onClick={() => loadFollowingPage(followingPage + 1)}>
                Neste
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {followingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Følger ingen ennå.</p>
            ) : (
              <ul className="space-y-3">
                {followingList.map(u => (
                  <li key={`${u.id}-${u.since}`} className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                    <div className="relative size-9 overflow-hidden rounded-full border">
                      {u.avatar_url ? (
                        <Image src={u.avatar_url} alt={u.username ?? 'avatar'} fill className="object-cover" sizes="36px" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link className="truncate font-medium hover:underline" href={`/u/${u.id}`}>
                        {u.username ?? u.id.slice(0, 8)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Siden {new Date(u.since).toLocaleDateString()}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                      <Link href={`/u/${u.id}`}>Se profil</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Statistikk</CardTitle>
          <CardDescription>Oppsummert fra treningsøkter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatTile label="Økter totalt" value={stats.totalSessions.toString()} />
            <StatTile label="Distanse totalt" value={`${Number(stats.totalDistance.toFixed(1))} km`} />
            <StatTile label="Økter siste 7 dager" value={stats.last7.toString()} />
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Innlegg</h2>
          <div className="flex gap-2">
            <Button size="sm" disabled={postPage === 0} onClick={() => setPostPage((p) => Math.max(0, p - 1))}>
              Forrige
            </Button>
            <Button size="sm" disabled={!hasMorePosts} onClick={() => setPostPage((p) => p + 1)}>
              Neste
            </Button>
          </div>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground text-center sm:text-left">
              Ingen innlegg ennå.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => {
              const like = likes[post.id] ?? { count: 0, liked: false }
              return (
                <li key={post.id}>
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row items-start gap-3">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-full border">
                          {profile.avatar_url ? (
                            <Image
                              src={profile.avatar_url}
                              alt={profile.username ?? 'avatar'}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1 w-full">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {profile.username ?? 'Ukjent'}
                            </span>{' '}
                            • {new Date(post.created_at).toLocaleString()}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{post.content}</p>
                          {post.image_url && (
                            <img
                              src={post.image_url}
                              alt="Innlegg"
                              className="mt-3 rounded-xl border max-w-full h-auto"
                            />
                          )}

                          <div className="mt-3 flex items-center gap-3">
                            <LikeButton postId={post.id} initialLiked={like.liked} initialCount={like.count} />
                          </div>

                          <div className="mt-4">
                            <CommentsList postId={post.id} />
                            <CommentFormInline postId={post.id} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function LikeButton({ postId, initialLiked, initialCount }: { postId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id
      if (!uid) return

      if (liked) {
        setLiked(false); setCount((c) => c - 1)
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid)
        if (error) { setLiked(true); setCount((c) => c + 1) }
      } else {
        setLiked(true); setCount((c) => c + 1)
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: uid })
        if (error) { setLiked(false); setCount((c) => c - 1) }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant={liked ? 'default' : 'outline'} onClick={toggle} disabled={busy}>
      👍 {count}
    </Button>
  )
}

function FollowButton({ profileId, onChange }: { profileId: string; onChange?: (following: boolean) => void }) {
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [me, setMe] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id ?? null
        if (cancelled) return
        setMe(uid)

        if (uid) {
          const { data, error } = await supabase.from('follows').select('follower_id').eq('follower_id', uid).eq('following_id', profileId).maybeSingle()
          if (!cancelled) setFollowing(!!data && !error)
        } else {
          if (!cancelled) setFollowing(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [profileId])

  const toggle = async () => {
    if (!me) return
    setLoading(true)
    try {
      if (following) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', profileId)
        if (!error) {
          setFollowing(false)
          onChange?.(false)
        }
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: profileId })
        if (!error) {
          setFollowing(true)
          onChange?.(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={toggle} disabled={loading} variant={following ? 'default' : 'outline'}>
      {following ? 'Følger' : 'Følg'}
    </Button>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm text-center sm:text-left">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

type CommentRow = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string | null; avatar_url: string | null } | null
}

function CommentsList({ postId }: { postId: string }) {
  const [items, setItems] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data?.user?.id ?? null))
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('comments').select(`
          id, post_id, user_id, content, created_at,
          profiles:user_id ( username, avatar_url )
        `).eq('post_id', postId).order('created_at', { ascending: true })
      if (!error) setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const onAdded = (e: any) => {
      if (e?.detail?.postId === postId) load()
    }
    window.addEventListener('comment:added', onAdded)

    const channel = supabase.channel(`comments:${postId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => load()).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => load()).subscribe()

    return () => {
      window.removeEventListener('comment:added', onAdded)
      supabase.removeChannel(channel)
    }
  }, [postId])

  const handleDelete = async (id: string) => {
    if (!me) return
    setBusyId(id)
    try {
      const prev = items
      setItems((list) => list.filter((x) => x.id !== id))

      const { error } = await supabase.from('comments').delete().eq('id', id).eq('user_id', me)
      if (error) {
        setItems(prev)
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Laster kommentarer …</div>
  if (items.length === 0) return <div className="text-sm text-muted-foreground">Ingen kommentarer ennå.</div>

  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <li key={c.id} className="flex flex-wrap sm:flex-nowrap items-start gap-2">
          <div className="relative size-7 overflow-hidden rounded-full border shrink-0">
            {c.profiles?.avatar_url ? (
              <Image src={c.profiles.avatar_url} alt={c.profiles.username ?? 'avatar'} fill className="object-cover" sizes="28px" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {c.profiles?.username ?? c.user_id.slice(0, 8)}
                </span>{' '}
                • {new Date(c.created_at).toLocaleString()}
              </div>
              {me === c.user_id && (
                <Button size="sm" variant="outline" onClick={() => handleDelete(c.id)} disabled={busyId === c.id}>
                  {busyId === c.id ? 'Sletter…' : 'Slett'}
                </Button>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">{c.content}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CommentFormInline({ postId }: { postId: string }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data?.user?.id))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id
      if (!uid) return

      const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: uid, content: value.trim() })
      if (!error) {
        setValue('')
        window.dispatchEvent(new CustomEvent('comment:added', { detail: { postId } }))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={authed ? 'Skriv en kommentar…' : 'Logg inn for å kommentere'}
        disabled={!authed || busy}
        className="flex-1 rounded border px-3 py-2 bg-white text-black disabled:opacity-50 w-full"
      />
      <Button type="submit" disabled={!authed || busy || !value.trim()} className="w-full sm:w-auto">
        Kommenter
      </Button>
    </form>
  )
}
