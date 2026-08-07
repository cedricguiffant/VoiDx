/**
 * Barème des récompenses (token virtuel) et garde-fous anti-abus.
 * Ces valeurs sont volontairement centralisées pour être ajustées facilement.
 */
export const REWARDS = {
  /** Points pour une conversation avec une NOUVELLE personne. */
  NEW_CONNECTION: 50,
  /** Points (plus faibles) pour une conversation RÉGULIÈRE. */
  REGULAR_CONVERSATION: 10,

  /**
   * Seuil qui qualifie une "conversation régulière" :
   * au moins N messages échangés sur la fenêtre glissante.
   */
  REGULAR_MIN_MESSAGES: 5,
  /** Fenêtre glissante en jours pour la régularité. */
  REGULAR_WINDOW_DAYS: 7,

  /**
   * Plafond journalier de points par utilisateur (anti-abus).
   * Également appliqué côté SQL dans award_reward().
   */
  DAILY_CAP: 500,
} as const;

export type RewardReason = "new_connection" | "regular_conversation";
