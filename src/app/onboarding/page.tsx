"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";

const LANGUAGES = ["fr", "en", "es", "de", "it", "pt", "ar"];

export default function OnboardingPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const updateProfileLocal = useAuthStore((s) => s.updateProfileLocal);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [interests, setInterests] = useState(profile?.interests?.join(", ") ?? "");
  const [language, setLanguage] = useState(profile?.language ?? "fr");
  const [isAnonymous, setIsAnonymous] = useState(profile?.is_anonymous ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation basique des inputs
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    const interestList = interests
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 10);

    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const patch = {
        username: username.trim(),
        bio: bio.trim() || null,
        interests: interestList,
        language,
        is_anonymous: isAnonymous,
        onboarded: true,
        updated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", profile!.id);
      if (upErr) throw upErr;

      updateProfileLocal(patch as never);
      router.replace("/discover");
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
          <CardTitle>Welcome to VoiDx 👋</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete your profile to start meeting people.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Username *</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nova_42"
                maxLength={30}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A few words about you…"
                maxLength={280}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Interests</label>
              <Input
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="music, video games, hiking"
              />
              <p className="text-xs text-muted-foreground">Comma-separated (max 10).</p>
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
              Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
