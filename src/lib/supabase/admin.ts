import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — SERVEUR UNIQUEMENT.
 * Bypasse la RLS : à n'utiliser que dans les routes API pour l'upsert
 * de profil à la connexion et l'attribution des récompenses.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
