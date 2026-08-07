/**
 * Préparation du futur "Claim" on-chain (token SPL).
 *
 * L'idée : convertir le solde virtuel (token_balance en base) en vrai token
 * SPL sur Solana. Le mint réel doit être signé par une autorité de mint
 * détenue côté serveur — JAMAIS exposée au client.
 *
 * Flux cible (à implémenter plus tard) :
 *  1. Le client appelle une route serveur /api/claim { amount }.
 *  2. Le serveur vérifie le solde disponible, applique d'éventuels plafonds,
 *     puis mint/transfère `amount` tokens vers l'ATA du wallet de l'utilisateur.
 *  3. On décrémente token_balance en base dans la même transaction logique.
 *
 * Ci-dessous, le squelette est volontairement laissé en commentaire tant que
 * le token SPL n'est pas déployé (NEXT_PUBLIC_TOKEN_MINT vide).
 */

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

export function isClaimEnabled(): boolean {
  return TOKEN_MINT.trim().length > 0;
}

/**
 * Stub : à remplacer par un appel à la route serveur /api/claim une fois
 * le token déployé. Retourne volontairement une erreur explicite pour l'instant.
 */
export async function claimTokens(_amount: number): Promise<never> {
  throw new Error(
    "On-chain claim is not available yet. The virtual VOID token will be convertible to SPL once the mint is deployed."
  );

  /* -------------------------------------------------------------------------
   * Exemple d'implémentation future (serveur, avec @solana/spl-token) :
   *
   * import { Connection, Keypair, PublicKey } from "@solana/web3.js";
   * import {
   *   getOrCreateAssociatedTokenAccount,
   *   mintTo,
   * } from "@solana/spl-token";
   *
   * const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!);
   * const mintAuthority = Keypair.fromSecretKey(...);   // SECRET côté serveur
   * const mint = new PublicKey(TOKEN_MINT);
   * const userAta = await getOrCreateAssociatedTokenAccount(
   *   connection, mintAuthority, mint, userPublicKey
   * );
   * await mintTo(connection, mintAuthority, mint, userAta.address,
   *   mintAuthority, amount);
   * // puis décrémenter token_balance en base.
   * ----------------------------------------------------------------------- */
}
