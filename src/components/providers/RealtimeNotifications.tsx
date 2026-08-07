"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { Avatar } from "@/components/ui/avatar";
import type { Message } from "@/types/database";

interface Toast {
  id: string;
  conversationId: string;
  name: string;
  preview: string;
}

/**
 * Abonnement Realtime global aux nouveaux messages. Grâce à la RLS
 * (messages_select_member), Supabase ne délivre que les messages des
 * conversations où l'utilisateur participe. On ignore :
 *   - ses propres messages,
 *   - les messages de la conversation actuellement ouverte (déjà lue).
 * Sinon : incrémente le compteur de non-lus + affiche un toast cliquable.
 */
export function RealtimeNotifications() {
  const router = useRouter();
  const me = useAuthStore((s) => s.profile);
  const status = useAuthStore((s) => s.status);
  const addUnread = useNotificationStore((s) => s.addUnread);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Cache local des pseudos d'expéditeurs pour éviter des requêtes répétées.
  const nameCache = useRef<Record<string, string>>({});

  useEffect(() => {
    if (status !== "authenticated" || !me) return;
    const supabase = getSupabaseBrowser();

    async function resolveName(senderId: string): Promise<string> {
      if (nameCache.current[senderId]) return nameCache.current[senderId];
      const { data } = await supabase
        .from("profiles")
        .select("username, is_anonymous")
        .eq("id", senderId)
        .maybeSingle();
      const name = data?.is_anonymous ? "Anonymous" : data?.username ?? "Someone";
      nameCache.current[senderId] = name;
      return name;
    }

    const channel = supabase
      .channel("global-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as Message;
          // Ignore ses propres messages.
          if (msg.sender_id === me!.id) return;
          // Ignore la conversation ouverte (lecture en direct dans le chat).
          if (useNotificationStore.getState().activeConversationId === msg.conversation_id) {
            return;
          }

          addUnread(msg.conversation_id);
          const name = await resolveName(msg.sender_id);
          const toast: Toast = {
            id: msg.id,
            conversationId: msg.conversation_id,
            name,
            preview: msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content,
          };
          setToasts((prev) => [...prev.slice(-2), toast]); // max 3 à l'écran
          // Auto-disparition après 5 s.
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [status, me, addUnread]);

  function openConversation(t: Toast) {
    setToasts((prev) => prev.filter((x) => x.id !== t.id));
    router.push(`/chat/${t.conversationId}`);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="button"
          tabIndex={0}
          onClick={() => openConversation(t)}
          onKeyDown={(e) => e.key === "Enter" && openConversation(t)}
          className="flex w-72 cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 shadow-lg transition-colors hover:bg-accent/50"
        >
          <Avatar name={t.name} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              {t.name}
            </div>
            <p className="truncate text-xs text-muted-foreground">{t.preview}</p>
          </div>
          <button
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
