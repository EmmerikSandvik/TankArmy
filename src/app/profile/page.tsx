// src/app/profile/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Profile = {
  id: string
  username: string | null
  bio: string | null
  avatar_url: string | null
}

type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
}

const POSTS_BUCKET = 'posts'
const AVATARS_BUCKET = 'avatars'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)

  // avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // post state
  const [postContent, setPostContent] = useState('')
  const [postImageFile, setPostImageFile] = useState<File | null>(null)
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const [posts, setPosts] = useState<Post[]>([])

  // objectURL refs for cleanup
  const avatarPreviewUrlRef = useRef<string | null>(null)
  const postPreviewUrlRef = useRef<string | null>(null)

  const myUserId = useMemo(() => user?.id ?? null, [user])

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u ?? null)
      if (!u) {
        setLoading(false)
        return
      }

      // hent/lag profil
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url')
        .eq('id', u.id)
        .maybeSingle()

      if (profErr) console.error('profiles select error:', profErr)

      let current: Profile | null = prof
      if (!prof) {
        const { data: inserted, error: insErr } = await supabase
          .from('profiles')
          .insert({ id: u.id })
          .select('id, username, bio, avatar_url')
          .single()
        if (insErr) console.error('profiles insert error:', insErr)
        current = inserted as Profile
      }

      if (current) {
        setProfile(current)
        setUsername(current.username ?? '')
        setBio(current.bio ?? '')
      }

      // følgere/følger
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', u.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', u.id),
      ])
      setFollowers(followersRes.count ?? 0)
      setFollowing(followingRes.count ?? 0)

      // mine innlegg
      const { data: myPosts, error: postsErr } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })

      if (postsErr) console.error('posts select error:', postsErr)
      setPosts(myPosts ?? [])

      setLoading(false)
    }
    init()

    // cleanup object URLs
    return () => {
      if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current)
      if (postPreviewUrlRef.current) URL.revokeObjectURL(postPreviewUrlRef.current)
    }
  }, [])

  const saveProfile = async () => {
    if (!myUserId) return
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: username || null,
        bio: bio || null,
      })
      .eq('id', myUserId)
      .select('id, username, bio, avatar_url')
      .single()

    if (error) console.error('saveProfile error:', error)
    else setProfile(data as Profile)

    setSaving(false)
  }

  // ---------- Shared upload helpers ----------
  const buildFilePath = (base: string, file: File) => {
    const mime = file.type || 'image/jpeg'
    const fallbackExt = mime.split('/')[1] || 'jpg'
    const nameExt = file.name.includes('.') ? (file.name.split('.').pop() || fallbackExt) : fallbackExt
    const ext = nameExt.toLowerCase()
    return `${base}/${crypto.randomUUID()}_${Date.now()}.${ext}`
  }

  const uploadToBucket = async (bucket: string, filePath: string, file: File) => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { contentType: file.type || 'image/jpeg', cacheControl: '3600' })
    if (error) {
      console.error('storage upload error:', { message: (error as any).message, status: (error as any).status })
      return null
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath)
    if (pub?.publicUrl) return pub.publicUrl

    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 dager
    if (signErr) {
      console.error('createSignedUrl error:', signErr)
      return null
    }
    return signed?.signedUrl ?? null
  }

  // ---------- Avatar ----------
  const onSelectAvatar: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null
    setAvatarFile(file)

    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current)
      avatarPreviewUrlRef.current = null
    }

    if (file) {
      if (!file.type.startsWith('image/')) {
        console.error('avatar error: not an image')
        setAvatarFile(null)
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        console.error('avatar error: file too large')
        setAvatarFile(null)
        return
      }
      const url = URL.createObjectURL(file)
      avatarPreviewUrlRef.current = url
      setAvatarPreview(url)
    } else {
      setAvatarPreview(null)
    }
  }

  const clearAvatarSelection = () => {
    setAvatarFile(null)
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current)
      avatarPreviewUrlRef.current = null
    }
    setAvatarPreview(null)
  }

  const uploadAvatar = async () => {
    if (!myUserId || !avatarFile) return
    setUploadingAvatar(true)
    try {
      const filePath = buildFilePath(`${myUserId}/avatar`, avatarFile)
      const url = await uploadToBucket(AVATARS_BUCKET, filePath, avatarFile)
      if (!url) return

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', myUserId)
        .select('id, username, bio, avatar_url')
        .single()

      if (error) {
        console.error('update avatar_url error:', error)
      } else {
        setProfile(data as Profile)
        clearAvatarSelection()
      }
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ---------- Posts ----------
  const onSelectPostImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null
    setPostImageFile(file)

    if (postPreviewUrlRef.current) {
      URL.revokeObjectURL(postPreviewUrlRef.current)
      postPreviewUrlRef.current = null
    }

    if (file) {
      if (!file.type.startsWith('image/')) {
        console.error('upload post image error: not an image')
        setPostImageFile(null)
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        console.error('upload post image error: file too large')
        setPostImageFile(null)
        return
      }
      const url = URL.createObjectURL(file)
      postPreviewUrlRef.current = url
      setPostImagePreview(url)
    } else {
      setPostImagePreview(null)
    }
  }

  const clearSelectedImage = () => {
    setPostImageFile(null)
    if (postPreviewUrlRef.current) {
      URL.revokeObjectURL(postPreviewUrlRef.current)
      postPreviewUrlRef.current = null
    }
    setPostImagePreview(null)
  }

  const createPost = async () => {
    if (!myUserId) return
    if (!postContent.trim() && !postImageFile) return

    setPosting(true)
    try {
      let imageUrl: string | null = null
      if (postImageFile) {
        const filePath = buildFilePath(`${myUserId}/posts`, postImageFile)
        imageUrl = await uploadToBucket(POSTS_BUCKET, filePath, postImageFile)
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: myUserId,
          content: postContent.trim() || '',
          image_url: imageUrl,
        })
        .select('*')
        .single()

      if (error) {
        console.error('createPost error:', error)
      } else if (data) {
        setPosts((prev) => [data as Post, ...prev])
        setPostContent('')
        clearSelectedImage()
      }
    } finally {
      setPosting(false)
    }
  }

  const deletePost = async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) {
      console.error('deletePost error:', error)
      return
    }
    setPosts((prev) => prev.filter((p) => p.id !== id))
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
      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle>Min profil</CardTitle>
          <CardDescription>Oppdater profilbilde, brukernavn og bio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="grid gap-3">
            <label className="text-sm font-medium">Profilbilde</label>
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarPreview || profile?.avatar_url || '/avatar-placeholder.png'}
                alt="avatar"
                className="h-16 w-16 rounded-full object-cover border"
              />
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={onSelectAvatar}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={uploadAvatar}
                    disabled={!avatarFile || uploadingAvatar}
                  >
                    {uploadingAvatar ? 'Laster opp…' : 'Lagre profilbilde'}
                  </Button>
                  {avatarPreview && (
                    <Button variant="secondary" size="sm" onClick={clearAvatarSelection}>
                      Fjern valg
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="grid gap-3">
            <label className="text-sm font-medium">Brukernavn</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded border px-3 py-2"
              placeholder="f.eks. emmerik"
            />
          </div>

          {/* Bio */}
          <div className="grid gap-3">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="rounded border px-3 py-2 min-h-[80px]"
              placeholder="Skriv litt om deg selv"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div><span className="font-semibold">{followers}</span> følgere</div>
            <div><span className="font-semibold">{following}</span> følger</div>
          </div>

          <div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? 'Lagrer…' : 'Lagre profil'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Nytt innlegg */}
      <Card>
        <CardHeader>
          <CardTitle>Nytt innlegg</CardTitle>
          <CardDescription>Legg til tekst og/eller bilde fra kamerarull/filer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="w-full rounded border px-3 py-2 min-h-[100px]"
            placeholder="Hva skjer i dag?"
          />
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onSelectPostImage}
              className="text-sm"
            />
            {postImagePreview && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={postImagePreview}
                  alt="forhåndsvisning"
                  className="h-12 w-12 rounded object-cover border"
                />
                <Button variant="destructive" size="sm" onClick={clearSelectedImage}>
                  Fjern
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={createPost} disabled={posting || (!postContent.trim() && !postImageFile)}>
              {posting ? 'Publiserer…' : 'Publiser'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
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
