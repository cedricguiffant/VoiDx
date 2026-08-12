import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getConnection,
  getTreasury,
  getMintPubkey,
  TOKEN_DECIMALS,
} from "@/lib/server/treasury";

/**
 * POST /api/claim
 * Convertit la totalité du solde virtuel VOID de l'utilisateur en vrais
 * tokens SPL envoyés à son wallet.
 *
 * Flux (sûr contre le double-claim) :
 *   1. Auth via JWT (Authorization: Bearer ...).
 *   2. claim_tokens() : décrément atomique du solde + claim 'pending'.
 *   3. Transfert on-chain trésor -> wallet de l'utilisateur.
 *   4a. Succès  : claim 'completed' + signature.
 *   4b. Échec   : refund_claim() restaure le solde + claim 'failed'.
 */
export async function POST(req: Request) {
  try {
    // 1) Authentification
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    let userId: string;
    try {
      const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string };
      userId = payload.sub;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Profil : adresse du wallet + solde à claim
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("wallet_address, token_balance")
      .eq("id", userId)
      .single();
    if (profErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const amount = Number(profile.token_balance ?? 0);
    if (amount <= 0) {
      return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
    }

    // 2) Réservation atomique (décrément + claim pending)
    const { data: claimId, error: reserveErr } = await admin.rpc("claim_tokens", {
      p_user_id: userId,
      p_amount: amount,
    });
    if (reserveErr || !claimId) {
      const msg = reserveErr?.message ?? "";
      if (msg.includes("INSUFFICIENT_BALANCE")) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
      }
      console.error("[claim] reserve error", reserveErr);
      return NextResponse.json({ error: "Could not reserve claim" }, { status: 500 });
    }

    // 3) Transfert on-chain
    try {
      const connection = getConnection();
      const treasury = getTreasury();
      const mint = getMintPubkey();
      const recipient = new PublicKey(profile.wallet_address);

      // ATA source (trésor) et destination (utilisateur, créée si absente).
      const sourceAta = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mint,
        treasury.publicKey
      );
      const destAta = await getOrCreateAssociatedTokenAccount(
        connection,
        treasury,
        mint,
        recipient
      );

      const baseUnits = BigInt(amount) * 10n ** BigInt(TOKEN_DECIMALS);
      const signature = await transfer(
        connection,
        treasury, // payeur des frais
        sourceAta.address,
        destAta.address,
        treasury, // propriétaire de la source
        baseUnits
      );

      // 4a) Finalisation
      await admin
        .from("claims")
        .update({
          status: "completed",
          tx_signature: signature,
          completed_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      return NextResponse.json({ signature, amount });
    } catch (chainErr) {
      // 4b) Échec on-chain -> remboursement du solde
      console.error("[claim] on-chain transfer failed", chainErr);
      await admin.rpc("refund_claim", { p_claim_id: claimId });
      return NextResponse.json(
        { error: "On-chain transfer failed — your balance was restored." },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error("[claim]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
