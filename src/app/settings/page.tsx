'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  username: string | null
  bio: string | null
}

type Visibility = 'public' | 'followers' | 'private'

type UserSettings = {
  id: string
  email_notifications: boolean
  inapp_notifications: boolean
  post_visibility: Visibility
  profile_visibility: Visibility
  comments_visibility: Visibility
  theme: 'system' | 'light' | 'dark'
  language: 'nb' | 'en'
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id'> = {
  email_notifications: true,
  inapp_notifications: true,
  post_visibility: 'public',
  profile_visibility: 'public',
  comments_visibility: 'public',
  theme: 'system',
  language: 'nb',
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { setTheme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const { data: auth } = await supabase.auth.getUser()
      const u = auth?.user ?? null
      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }
      setUser(u)

      // Profile
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, bio')
        .eq('id', u.id)
        .maybeSingle()

      setProfile(p ?? { id: u.id, username: null, bio: null })

      // Settings
      const { data: s } = await supabase
        .from('user_settings')
        .select(
          'id, email_notifications, inapp_notifications, post_visibility, profile_visibility, comments_visibility, theme, language'
        )
        .eq('id', u.id)
        .maybeSingle()

      setSettings(s ?? { id: u.id, ...DEFAULT_SETTINGS })
      setLoading(false)
    }

    load()
  }, [])

  const handleProfileChange = (field: keyof Omit<Profile, 'id'>, value: string) => {
    if (!profile) return
    setProfile({ ...profile, [field]: value })
  }

  const handleSettingsChange = <K extends keyof Omit<UserSettings, 'id'>>(
    field: K,
    value: UserSettings[K]
  ) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  const saveAll = async () => {
    if (!user || !profile || !settings) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    // Save profile
    await supabase.from('profiles').upsert(
      { id: user.id, username: profile.username, bio: profile.bio },
      { onConflict: 'id' }
    )

    // Save settings
    await supabase.from('user_settings').upsert(
      {
        id: user.id,
        email_notifications: settings.email_notifications,
        inapp_notifications: settings.inapp_notifications,
        post_visibility: settings.post_visibility,
        profile_visibility: settings.profile_visibility,
        comments_visibility: settings.comments_visibility,
        theme: settings.theme,
        language: settings.language,
      },
      { onConflict: 'id' }
    )

    setSuccess('Lagret!')
    setSaving(false)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Innstillinger</CardTitle>
          <CardDescription>Laster…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logg inn</CardTitle>
          <CardDescription>Du må være innlogget for å se innstillinger.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/">Gå til forsiden</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Innstillinger</h1>
        <p className="text-sm text-muted-foreground">Oppdater profilen og preferansene dine.</p>
      </div>

      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">{error}</div>}
      {success && <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm">{success}</div>}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="prefs">Innstillinger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Oppdater brukernavn og bio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Brukernavn</Label>
                <Input
                  id="username"
                  value={profile?.username ?? ''}
                  onChange={(e) => handleProfileChange('username', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={profile?.bio ?? ''}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="prefs">
          <Card>
            <CardHeader>
              <CardTitle>Preferanser</CardTitle>
              <CardDescription>Varsler, synlighet, tema og språk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Varsler */}
              <div className="space-y-2">
                <h3 className="font-medium">Varsler</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-noti">E-postvarsler</Label>
                  <Switch
                    id="email-noti"
                    checked={!!settings?.email_notifications}
                    onCheckedChange={(v) => handleSettingsChange('email_notifications', Boolean(v))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="inapp-noti">Varsler i appen</Label>
                  <Switch
                    id="inapp-noti"
                    checked={!!settings?.inapp_notifications}
                    onCheckedChange={(v) => handleSettingsChange('inapp_notifications', Boolean(v))}
                  />
                </div>
              </div>

              {/* Synlighet */}
              <div className="space-y-2">
                <h3 className="font-medium">Synlighet</h3>
                <Label>Innlegg</Label>
                <Select
                  value={settings?.post_visibility ?? 'public'}
                  onValueChange={(v: Visibility) => handleSettingsChange('post_visibility', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Offentlig</SelectItem>
                    <SelectItem value="followers">Kun følgere</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Profil</Label>
                <Select
                  value={settings?.profile_visibility ?? 'public'}
                  onValueChange={(v: Visibility) => handleSettingsChange('profile_visibility', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Offentlig</SelectItem>
                    <SelectItem value="followers">Kun følgere</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Kommentarer</Label>
                <Select
                  value={settings?.comments_visibility ?? 'public'}
                  onValueChange={(v: Visibility) => handleSettingsChange('comments_visibility', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Offentlig</SelectItem>
                    <SelectItem value="followers">Kun følgere</SelectItem>
                    <SelectItem value="private">Privat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Utseende & språk */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Tema</Label>
                  <Select
                    value={settings?.theme ?? 'system'}
                    onValueChange={(v: 'system' | 'light' | 'dark') => {
                      handleSettingsChange('theme', v)
                      setTheme(v) // live
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Lyst</SelectItem>
                      <SelectItem value="dark">Mørkt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Språk</Label>
                  <Select
                    value={settings?.language ?? 'nb'}
                    onValueChange={(v: 'nb' | 'en') => {
                      handleSettingsChange('language', v)
                      document.cookie = `lang=${v}; path=/; max-age=${60*60*24*365}`
                      router.refresh() // oppdater for å hente nye tekster
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nb">Norsk (Bokmål)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? 'Lagrer…' : 'Lagre endringer'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
