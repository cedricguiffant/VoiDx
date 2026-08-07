"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { truncateAddress } from "@/lib/utils";

const LANGUAGES = ["fr", "en", "es", "de", "it", "pt", "ar"];

export default function ProfilePage() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfileLocal = useAuthStore((s) => s.updateProfileLocal);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [interests, setInterests] = useState(profile?.interests?.join(", ") ?? "");
  const [language, setLanguage] = useState(profile?.language ?? "fr");
  const [isAnonymous, setIsAnonymous] = useState(profile?.is_anonymous ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const patch = {
        username: username.trim(),
        bio: bio.trim() || null,
        interests: interests.split(",").map((i) => i.trim()).filter(Boolean).slice(0, 10),
        language,
        is_anonymous: isAnonymous,
        updated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", profile!.id);
      if (upErr) throw upErr;
      updateProfileLocal(patch as never);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{profile.token_balance} VOID</Badge>
            <span>{truncateAddress(profile.wallet_address)}</span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Interests</label>
              <Input
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="music, sports, reading"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Stay anonymous
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
