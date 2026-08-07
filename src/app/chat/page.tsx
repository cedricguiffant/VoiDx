"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { Conversation, Profile, ConversationWithPeer } from "@/types/database";

export default function ChatListPage() {
  const me = useAuthStore((s) => s.profile);
  const unread = useNotificationStore((s) => s.unread);
  const [items, setItems] = useState<ConversationWithPeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    (async () => {
      setLoading(true);
      const supabase = getSupabaseBrowser();

      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant1.eq.${me.id},participant2.eq.${me.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      const list = (convos as Conversation[]) ?? [];
      const peerIds = list.map((c) => (c.participant1 === me.id ? c.participant2 : c.participant1));

      let peers: Record<string, Profile> = {};
      if (peerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, wallet_address, is_anonymous")
          .in("id", peerIds);
        peers = Object.fromEntries((profs ?? []).map((p) => [p.id, p as Profile]));
      }

      setItems(
        list.map((c) => {
          const peerId = c.participant1 === me.id ? c.participant2 : c.participant1;
          return { ...c, peer: peers[peerId] } as ConversationWithPeer;
        })
      );
      setLoading(false);
    })();
  }, [me]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10" />
          <p>No conversations yet. Go discover people!</p>
          <Link href="/discover" className="text-sm font-medium text-primary underline">
            Discover
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const name = c.peer?.is_anonymous ? "Anonymous" : c.peer?.username ?? "No name";
            return (
              <Link key={c.id} href={`/chat/${c.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{name}</span>
                        {c.is_new_connection ? (
                          <Badge variant="success" className="gap-1">
                            <Sparkles className="h-3 w-3" /> New person
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Regular</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleString()
                          : "No message yet"}
                      </p>
                    </div>
                    {unread[c.id] > 0 && (
                      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {unread[c.id] > 9 ? "9+" : unread[c.id]}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
