"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Search, Loader2, Sparkles } from "lucide-react";
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
  const [sort, setSort] = useState<"match" | "recent">("match");
  const [starting, setStarting] = useState<string | null>(null);

  // Intérêts de l'utilisateur, normalisés, pour calculer l'affinité.
  const myInterests = useMemo(
    () => new Set((me?.interests ?? []).map((i) => i.toLowerCase())),
    [me]
  );

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

  // Filtre (intérêts + langue) puis calcule l'affinité (intérêts en commun)
  // et trie selon le mode choisi.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = people
      .filter((p) => {
        const matchLang = !lang || p.language === lang;
        const matchQuery =
          !q ||
          p.username?.toLowerCase().includes(q) ||
          p.interests.some((i) => i.toLowerCase().includes(q));
        return matchLang && matchQuery;
      })
      .map((p) => ({
        p,
        // Intérêts partagés (en conservant la casse d'origine du profil).
        common: p.interests.filter((i) => myInterests.has(i.toLowerCase())),
      }));

    if (sort === "match") {
      // Plus d'intérêts en commun d'abord ; à égalité, les plus récents.
      list.sort((a, b) => b.common.length - a.common.length);
    }
    // "recent" : on garde l'ordre de la requête (created_at desc).
    return list;
  }, [people, query, lang, sort, myInterests]);

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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "match" | "recent")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          title="Sort order"
        >
          <option value="match">Best match</option>
          <option value="recent">Newest</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No one to show yet. Check back later!
        </p>
      ) : (
        <div className="space-y-3">
          {results.map(({ p, common }) => {
            const commonSet = new Set(common.map((i) => i.toLowerCase()));
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar name={p.is_anonymous ? "Anonymous" : p.username} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {p.is_anonymous ? "Anonymous" : p.username ?? "No name"}
                      </span>
                      <Badge variant="outline">{p.language.toUpperCase()}</Badge>
                      {common.length > 0 && (
                        <Badge variant="success" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          {common.length} in common
                        </Badge>
                      )}
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
                        {/* Intérêts partagés d'abord, mis en avant. */}
                        {[...p.interests]
                          .sort(
                            (a, b) =>
                              Number(commonSet.has(b.toLowerCase())) -
                              Number(commonSet.has(a.toLowerCase()))
                          )
                          .slice(0, 5)
                          .map((i) => {
                            const shared = commonSet.has(i.toLowerCase());
                            return (
                              <Badge
                                key={i}
                                variant={shared ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {i}
                              </Badge>
                            );
                          })}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
