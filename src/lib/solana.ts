/**
 * Claim on-chain (token SPL VOID) — côté client.
 *
 * Le solde virtuel (token_balance en base) est convertible en vrais tokens SPL.
 * Toute la logique sensible (clé du trésor, transfert, décrément atomique) vit
 * côté serveur dans /api/claim ; ici on ne fait qu'appeler cette route.
 */

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

/** Le claim est activé dès qu'un mint est configuré. */
export function isClaimEnabled(): boolean {
  return TOKEN_MINT.trim().length > 0;
}

export interface ClaimResult {
  signature: string;
  amount: number;
}

/**
 * Déclenche le claim : convertit la totalité du solde virtuel en tokens SPL
 * envoyés au wallet de l'utilisateur.
 * @param token JWT de session (Authorization: Bearer ...)
 */
export async function claimTokens(token: string): Promise<ClaimResult> {
  const res = await fetch("/api/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Claim failed");
  }
  return data as ClaimResult;
}

/** Lien explorer pour une transaction (devnet par défaut). */
export function explorerTxUrl(signature: string): string {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
