/** Types applicatifs alignés sur le schéma Supabase (supabase/schema.sql). */

export interface Profile {
  id: string;
  wallet_address: string;
  username: string | null;
  bio: string | null;
  interests: string[];
  language: string;
  is_anonymous: boolean;
  token_balance: number;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant1: string;
  participant2: string;
  is_new_connection: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface RewardLog {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  related_conversation_id: string | null;
  created_at: string;
}

/** Conversation enrichie de l'autre participant (côté UI). */
export interface ConversationWithPeer extends Conversation {
  peer: Pick<Profile, "id" | "username" | "wallet_address" | "is_anonymous">;
}
