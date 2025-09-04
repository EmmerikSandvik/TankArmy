'use client'

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Profile = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
}

type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Followers/following counts
  const [followers, setFollowers] = useState<number>(0)
  const [following, setFollowing] = useState<number>(0)

  // Posts
  const [postContent, setPostContent] = useState("")
  const [posts, setPosts] = useState<Post[]>([])

  const myUserId = useMemo(() => user?.id ?? null, [user])

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u ?? null)
      if (!u) {
        setLoading(false)
        return
      }

      // Hent profil, eller lag en tom hvis den ikke finnes
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle()

      if (pErr) console.error(pErr)

      let current: Profile | null = prof
      if (!prof) {
        const { data: inserted, error: iErr } = await supabase
          .from("profiles")
          .insert({ id: u.id })
          .select("*")
          .single()
        if (iErr) console.error(iErr)
        current = inserted as Profile
      }

      if (current) {
        setProfile(current)
        setUsername(current.username ?? "")
        setBio(current.bio ?? "")
        setAvatarUrl(current.avatar_url ?? null)
      }

      // Teller for followers/following
      const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", u.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", u.id),
      ])
      setFollowers(followersCount ?? 0)
      setFollowing(followingCount ?? 0)

      // Hent egne posts
      const { data: myPosts, error: postErr } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
      if (postErr) console.error(postErr)
      setPosts(myPosts ?? [])

      setLoading(false)
    }

    init()
  }, [])

  const saveProfile = async () => {
    if (!myUserId) return
    setSaving(true)
    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: username || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", myUserId)
      .select("*")
      .single()

    if (error) {
      console.error(error)
    } else {
      setProfile(data as Profile)
    }
    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!myUserId) return
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const filePath = `${myUserId}/avatar.${ext}`

      // Last opp til storage
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true })
      if (upErr) throw upErr

      // Hent public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      const newUrl = publicUrlData.publicUrl
      setAvatarUrl(newUrl)

      // Lagre i profile
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", myUserId)

      if (updErr) throw updErr
    } catch (err) {
      console.error(err)
    } finally {
      setAvatarUploading(false)
    }
  }

  const createPost = async () => {
    if (!myUserId || !postContent.trim()) return
    const { data, error } = await supabase
      .from("posts")
      .insert({ user_id: myUserId, content: postContent.trim() })
      .select("*")
      .single()
    if (error) {
      console.error(error)
      return
    }
    setPosts((prev) => [data as Post, ...prev])
    setPostContent("")
  }

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id)
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Laster profil…</CardTitle>
            <CardDescription>Henter bruker og data.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-24 bg-gray-200 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Ingen bruker</CardTitle>
            <CardDescription>Du må logge inn for å se profilen din.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 space-y-6">
      {/* Profil-kort */}
      <Card>
        <CardHeader>
          <CardTitle>Min Profil</CardTitle>
          <CardDescription>Oppdater brukerinformasjon og avatar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-sm text-gray-500">Ingen</div>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
                className="block text-sm"
              />
              {avatarUploading && <p className="text-xs text-gray-500 mt-1">Laster opp…</p>}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Brukernavn</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded border px-3 py-2"
              placeholder="f.eks. emmerik"
            />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="rounded border px-3 py-2 min-h-[80px]"
              placeholder="Skriv litt om deg selv"
            />
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div><span className="font-semibold">{followers}</span> følgere</div>
            <div><span className="font-semibold">{following}</span> følger</div>
          </div>

          <div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Lagrer…" : "Lagre profil"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Nytt innlegg */}
      <Card>
        <CardHeader>
          <CardTitle>Nytt innlegg</CardTitle>
          <CardDescription>Del en kort oppdatering</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="w-full rounded border px-3 py-2 min-h-[100px]"
            placeholder="Hva skjer i dag?"
          />
          <div className="flex justify-end">
            <Button onClick={createPost} disabled={!postContent.trim()}>
              Publiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Innleggsfeed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle className="text-base">Innlegg</CardTitle>
              <CardDescription>
                {new Date(post.created_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap">{post.content}</p>
              {post.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image_url} alt="post" className="rounded-xl w-full" />
              )}
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => deletePost(post.id)}>
                  Slett
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingen innlegg ennå</CardTitle>
              <CardDescription>Publiser ditt første innlegg ovenfor.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}
