import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// IMPORTANT : sans ça, Next.js prérend ce GET en statique au build et fige
// la date -> tous les messages deviennent "expired". On force l'exécution
// à chaque requête pour générer un nonce + une date frais.
export const dynamic = "force-dynamic";

/**
 * Renvoie un message à signer par Phantom (Sign-In With Solana).
 * MVP stateless : on embarque un nonce + un timestamp dans le message,
 * et /verify contrôle la fraîcheur (pas de stockage de nonce nécessaire).
 * Pour durcir : persister le nonce (table/redis) et le consommer une fois.
 */
export async function GET() {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const message =
    `VoiDx — Sign in\n\n` +
    `Sign this message to prove you own this wallet.\n` +
    `No transaction, no fees.\n\n` +
    `Nonce: ${nonce}\n` +
    `Date: ${issuedAt}`;

  return NextResponse.json({ message, issuedAt });
}
