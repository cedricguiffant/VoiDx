"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Sign-In With Solana :
 *  1. récupère un message à signer (/api/auth/nonce)
 *  2. le fait signer par Phantom
 *  3. le vérifie côté serveur (/api/auth/verify) qui renvoie un JWT + profil
 *  4. applique la session dans le store + client Supabase
 */
export function useSignIn() {
  const { publicKey, signMessage, connected } = useWallet();
  const setSession = useAuthStore((s) => s.setSession);
  const setStatus = useAuthStore((s) => s.setStatus);

  const signIn = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) {
      throw new Error("Wallet not connected");
    }
    setStatus("authenticating");
    try {
      const walletAddress = publicKey.toBase58();

      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Could not get nonce");
      const { message } = await nonceRes.json();

      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(signatureBytes);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, message, signature }),
      });
      if (!verifyRes.ok) {
        const { error } = await verifyRes.json().catch(() => ({ error: "Failed" }));
        throw new Error(error ?? "Verification failed");
      }
      const { token, profile } = await verifyRes.json();
      await setSession(token, profile);
      return profile;
    } catch (e) {
      setStatus("idle");
      throw e;
    }
  }, [connected, publicKey, signMessage, setSession, setStatus]);

  return { signIn };
}
