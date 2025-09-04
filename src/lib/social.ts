import { supabase } from "@/lib/supabase"

export async function getMyUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function getPeople(limit = 20) {
  const me = await getMyUser()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name")
    .neq("id", me?.id ?? "")
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function isFollowing(targetUserId: string) {
  const me = await getMyUser()
  if (!me) return false
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", me.id)
    .eq("following_id", targetUserId)
    .maybeSingle()
  if (error && error.code !== "PGRST116") throw error
  return !!data
}

export async function follow(targetUserId: string) {
  const me = await getMyUser()
  if (!me) throw new Error("Ikke innlogget")
  const { error } = await supabase.from("follows").insert({
    follower_id: me.id,
    following_id: targetUserId,
  })
  if (error && error.code !== "23505") throw error // ignore duplicate
  return true
}

export async function unfollow(targetUserId: string) {
  const me = await getMyUser()
  if (!me) throw new Error("Ikke innlogget")
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me.id)
    .eq("following_id", targetUserId)
  if (error) throw error
  return true
}

export async function getCounts(userId: string) {
  // followers = hvor mange følger denne brukeren
  const { count: followers, error: e1 } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId)
  if (e1) throw e1

  // following = hvor mange denne brukeren følger
  const { count: following, error: e2 } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId)
  if (e2) throw e2

  return { followers: followers ?? 0, following: following ?? 0 }
}

export async function listFollowers(userId: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, profiles!follows_follower_id_fkey(id, username, full_name)")
    .eq("following_id", userId)
  if (error) throw error
  // @ts-ignore - aliased join
  return (data ?? []).map((r) => r.profiles)
}

export async function listFollowing(userId: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id, profiles!follows_following_id_fkey(id, username, full_name)")
    .eq("follower_id", userId)
  if (error) throw error
  // @ts-ignore
  return (data ?? []).map((r) => r.profiles)
}
