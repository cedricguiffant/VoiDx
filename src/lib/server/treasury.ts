import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Accès au trésor VoiDx (mint authority + réserve) — SERVEUR UNIQUEMENT.
 *
 * Deux modes de chargement de la clé :
 *  1. Production (Vercel) : variable d'env TREASURY_SECRET_KEY
 *     (tableau JSON [..] à 64 octets, ou chaîne base58).
 *  2. Développement local : fichier keypair au format CLI Solana
 *     (TREASURY_KEYPAIR_PATH, défaut ~/voidx-treasury.json).
 *
 * Ne jamais importer ce module depuis un composant client.
 */
export function getConnection(): Connection {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
  return new Connection(rpc, "confirmed");
}

export function getTreasury(): Keypair {
  const raw = process.env.TREASURY_SECRET_KEY?.trim();
  if (raw) {
    const secret = raw.startsWith("[")
      ? Uint8Array.from(JSON.parse(raw))
      : bs58.decode(raw);
    return Keypair.fromSecretKey(secret);
  }
  // Fallback local : fichier keypair.
  const path = process.env.TREASURY_KEYPAIR_PATH || join(homedir(), "voidx-treasury.json");
  const secret = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")));
  return Keypair.fromSecretKey(secret);
}

export function getMintPubkey(): PublicKey {
  const mint = process.env.NEXT_PUBLIC_TOKEN_MINT?.trim();
  if (!mint) throw new Error("NEXT_PUBLIC_TOKEN_MINT non défini");
  return new PublicKey(mint);
}

/** Décimales du token VOID (doit correspondre au mint créé). */
export const TOKEN_DECIMALS = 9;
