import jwt from "jsonwebtoken";

/**
 * Forge un JWT Supabase valide APRÈS vérification de la signature Phantom.
 * Signé avec le JWT Secret de Supabase => accepté par PostgREST/Realtime,
 * et auth.uid() = `userId` dans les policies RLS.
 *
 * NB : usage strictement serveur (route /api/auth/verify).
 */
export function signSupabaseJwt(userId: string, walletAddress: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET manquant");

  const nowSec = Math.floor(Date.now() / 1000);
  const oneWeek = 60 * 60 * 24 * 7;

  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iat: nowSec,
      exp: nowSec + oneWeek,
      // claim custom, lisible via auth.jwt() côté Postgres si besoin
      wallet_address: walletAddress,
      user_metadata: { wallet_address: walletAddress },
    },
    secret,
    { algorithm: "HS256" }
  );
}
