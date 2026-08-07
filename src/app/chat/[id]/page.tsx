"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import type { Conversation, Message, Profile } from "@/types/database";

export default function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useAuthStore((s) => s.profile);
  const token = useAuthStore((s) => s.token);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [convo, setConvo] = useState<Conversation | null>(null);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Chargement initial + abonnement Realtime
  useEffect(() => {
    if (!me || !id) return;
    const supabase = getSupabaseBrowser();
    let active = true;

    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!active) return;
      if (!c) {
        router.replace("/chat");
        return;
      }
      setConvo(c as Conversation);

      const peerId = c.participant1 === me.id ? c.participant2 : c.participant1;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, wallet_address, is_anonymous")
        .eq("id", peerId)
        .single();
      if (active) setPeer(p as Profile);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      if (active) setMessages((msgs as Message[]) ?? []);
      setLoading(false);
    })();

    // Realtime : nouveaux messages de cette conversation
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [me, id, router]);

  // Auto-scroll en bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(content: string) {
    if (!me || !id) return;
    const supabase = getSupabaseBrowser();

    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: me.id, content });
    if (error) throw error;

    // Évaluation des récompenses côté serveur (idempotent).
    try {
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: id }),
      });
      if (res.ok) {
        const { awarded } = await res.json();
        if (awarded > 0) {
          setToast(`+${awarded} VOID earned!`);
          await refreshProfile();
          setTimeout(() => setToast(null), 3000);
        }
      }
    } catch {
      /* les récompenses ne doivent jamais bloquer l'envoi */
    }
  }

  const peerName = peer?.is_anonymous ? "Anonymous" : peer?.username ?? "No name";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col rounded-lg border border-border">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <button onClick={() => router.push("/chat")} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={peerName} className="h-9 w-9" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{peerName}</span>
            {convo?.is_new_connection ? (
              <Badge variant="success" className="gap-1">
                <Sparkles className="h-3 w-3" /> New person
              </Badge>
            ) : (
              <Badge variant="secondary">Regular conversation</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className={`h-10 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Say hi 👋 — your first real exchange earns you VOID.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.sender_id === me?.id} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Toast récompense */}
      {toast && (
        <div className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-md bg-emerald-500/15 py-2 text-sm font-medium text-emerald-500">
          <Coins className="h-4 w-4" /> {toast}
        </div>
      )}

      <MessageInput onSend={handleSend} />
    </div>
  );
}
