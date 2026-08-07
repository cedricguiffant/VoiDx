"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté navigateur avec AUTH CUSTOM (Sign-In With Solana).
 *
 * On n'utilise pas GoTrue (supabase.auth) : notre JWT est forgé côté serveur
 * après vérification de la signature Phantom. L'option `accessToken` injecte
 * ce JWT comme Bearer sur PostgREST ET Realtime, sans que GoTrue ait besoin
 * de connaître l'utilisateur. Les policies RLS lisent alors `auth.uid()` = sub.
 */
let currentAccessToken: string | null = null;
let browserClient: SupabaseClient | null = null;

/** Définit (ou efface) le JWT courant utilisé pour toutes les requêtes. */
export function setAccessToken(token: string | null) {
  currentAccessToken = token;
  // Met à jour l'auth Realtime immédiatement.
  browserClient?.realtime.setAuth(token ?? "");
}

export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Callback lu à chaque requête : renvoie le JWT custom (ou null = anon).
      accessToken: async () => currentAccessToken,
    }
  );
  return browserClient;
}
