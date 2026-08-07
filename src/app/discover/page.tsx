"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/chat";
import { useAuthStore } from "@/store/useAuthStore";
import { truncateAddress } from "@/lib/utils";
import type { Profile } from "@/types/database";

export default function DiscoverPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.profile);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("");
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    (async () => {
      setLoading(true);
      const supabase = getSupabaseBrowser();
      // On ne montre que les profils complétés, hors soi-même.
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("onboarded", true)
        .neq("id", me.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setPeople((data as Profile[]) ?? []);
      setLoading(false);
    })();
  }, [me]);

  // Filtres simples côté client (intérêts + langue).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      const matchLang = !lang || p.language === lang;
      const matchQuery =
        !q ||
        p.username?.toLowerCase().includes(q) ||
        p.interests.some((i) => i.toLowerCase().includes(q));
      return matchLang && matchQuery;
    });
  }, [people, query, lang]);

  const languages = useMemo(
    () => Array.from(new Set(people.map((p) => p.language))).sort(),
    [people]
  );

  async function startConversation(peer: Profile) {
    if (!me) return;
    setStarting(peer.id);
    try {
      const convoId = await getOrCreateConversation(me.id, peer.id);
      router.push(`/chat/${convoId}`);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover people</h1>
        <p className="text-sm text-muted-foreground">
          Talk to someone new and earn more VOID.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username or interest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No one to show yet. Check back later!
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar name={p.is_anonymous ? "Anonymous" : p.username} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">
                      {p.is_anonymous ? "Anonymous" : p.username ?? "No name"}
                    </span>
                    <Badge variant="outline">{p.language.toUpperCase()}</Badge>
                  </div>
                  {!p.is_anonymous && (
                    <p className="text-xs text-muted-foreground">
                      {truncateAddress(p.wallet_address)}
                    </p>
                  )}
                  {p.bio && (
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{p.bio}</p>
                  )}
                  {p.interests.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.interests.slice(0, 4).map((i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {i}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => startConversation(p)}
                  disabled={starting === p.id}
                >
                  {starting === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Chat</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
