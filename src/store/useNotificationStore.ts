"use client";

import { create } from "zustand";

/**
 * État léger des notifications de messages.
 * - activeConversationId : la conversation actuellement ouverte (pour ne pas
 *   notifier un message qu'on est déjà en train de lire).
 * - unread : compteur de messages non lus par conversation.
 */
interface NotificationState {
  activeConversationId: string | null;
  unread: Record<string, number>;

  /** Définit la conversation ouverte et remet son compteur à zéro. */
  setActiveConversation: (id: string | null) => void;
  /** Incrémente le compteur de non-lus d'une conversation. */
  addUnread: (conversationId: string) => void;
  /** Remet à zéro le compteur d'une conversation. */
  clear: (conversationId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  activeConversationId: null,
  unread: {},

  setActiveConversation: (id) =>
    set((s) => {
      if (!id) return { activeConversationId: null };
      const unread = { ...s.unread };
      delete unread[id];
      return { activeConversationId: id, unread };
    }),

  addUnread: (conversationId) =>
    set((s) => ({
      unread: { ...s.unread, [conversationId]: (s.unread[conversationId] ?? 0) + 1 },
    })),

  clear: (conversationId) =>
    set((s) => {
      const unread = { ...s.unread };
      delete unread[conversationId];
      return { unread };
    }),
}));

/** Sélecteur : total de messages non lus (toutes conversations confondues). */
export const selectTotalUnread = (s: NotificationState) =>
  Object.values(s.unread).reduce((a, b) => a + b, 0);
