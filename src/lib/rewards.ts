import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { REWARDS } from "@/lib/constants";

/**
 * Évalue et attribue les récompenses pour un utilisateur donné sur une
 * conversation, après l'envoi d'un message. Idempotent grâce à la fonction
 * SQL award_reward (anti-doublon + plafond journalier).
 *
 * Règles :
 *  - new_connection      : +NEW_CONNECTION, une seule fois par conversation
 *                          (dès qu'un vrai échange a lieu : >= 2 messages).
 *  - regular_conversation: +REGULAR_CONVERSATION (plus faible), une fois par
 *                          jour, si >= REGULAR_MIN_MESSAGES sur la fenêtre
 *                          glissante des REGULAR_WINDOW_DAYS derniers jours.
 *
 * @returns le total de points attribués lors de cet appel.
 */
export async function evaluateAndAward(
  userId: string,
  conversationId: string
): Promise<{ awarded: number; details: Record<string, number> }> {
  const admin = getSupabaseAdmin();
  const details: Record<string, number> = {};
  let awarded = 0;

  // 1) Charger la conversation et vérifier l'appartenance
  const { data: convo, error: convoErr } = await admin
    .from("conversations")
    .select("id, participant1, participant2, message_count")
    .eq("id", conversationId)
    .single();

  if (convoErr || !convo) return { awarded: 0, details };
  if (convo.participant1 !== userId && convo.participant2 !== userId) {
    return { awarded: 0, details };
  }

  // 2) Récompense "nouvelle personne" — une seule fois par conversation
  if (convo.message_count >= 2) {
    const { count } = await admin
      .from("reward_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "new_connection")
      .eq("related_conversation_id", conversationId);

    if ((count ?? 0) === 0) {
      const { data: got } = await admin.rpc("award_reward", {
        p_user_id: userId,
        p_amount: REWARDS.NEW_CONNECTION,
        p_reason: "new_connection",
        p_conversation_id: conversationId,
        p_daily_cap: REWARDS.DAILY_CAP,
      });
      const val = Number(got ?? 0);
      if (val > 0) {
        details.new_connection = val;
        awarded += val;
      }
    }
  }

  // 3) Récompense "conversation régulière" — au moins N messages sur la fenêtre
  const windowStart = new Date(
    Date.now() - REWARDS.REGULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: recentMsgs } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .gte("created_at", windowStart);

  if ((recentMsgs ?? 0) >= REWARDS.REGULAR_MIN_MESSAGES) {
    // award_reward applique déjà "une fois par jour" (anti-doublon interne)
    const { data: got } = await admin.rpc("award_reward", {
      p_user_id: userId,
      p_amount: REWARDS.REGULAR_CONVERSATION,
      p_reason: "regular_conversation",
      p_conversation_id: conversationId,
      p_daily_cap: REWARDS.DAILY_CAP,
    });
    const val = Number(got ?? 0);
    if (val > 0) {
      details.regular_conversation = val;
      awarded += val;
    }
  }

  return { awarded, details };
}
