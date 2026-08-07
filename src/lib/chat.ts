"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Récupère (ou crée) la conversation entre deux profils.
 * On respecte la contrainte SQL participant1 < participant2 pour garantir
 * l'unicité de la paire, quel que soit l'ordre d'appel.
 */
export async function getOrCreateConversation(
  myId: string,
  peerId: string
): Promise<string> {
  const [participant1, participant2] = [myId, peerId].sort();
  const supabase = getSupabaseBrowser();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant1", participant1)
    .eq("participant2", participant2)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ participant1, participant2 })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}
