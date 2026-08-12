import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { walletToUserId } from "@/lib/auth/userId";
import { signSupabaseJwt } from "@/lib/auth/jwt";

const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes (fenêtre anti-rejeu)

/**
 * Vérifie la signature Phantom du message, puis :
 *  - upsert du profil (id déterministe dérivé du wallet)
 *  - forge un JWT Supabase => session authentifiée côté client
 */
export async function POST(req: Request) {
  try {
    const { walletAddress, message, signature } = await req.json();

    if (!walletAddress || !message || !signature) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 1) Fraîcheur du message (anti-rejeu basique)
    const dateMatch = /Date:\s*(.+)$/m.exec(message);
    const issuedAt = dateMatch ? Date.parse(dateMatch[1].trim()) : NaN;
    if (Number.isNaN(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) {
      return NextResponse.json({ error: "Message expired, please retry." }, { status: 401 });
    }

    // 2) Vérification cryptographique de la signature
    let pubkeyBytes: Uint8Array;
    try {
      pubkeyBytes = new PublicKey(walletAddress).toBytes();
    } catch {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      pubkeyBytes
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3) Upsert du profil (service_role, bypass RLS)
    const userId = walletToUserId(walletAddress);
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await admin.from("profiles").insert({
        id: userId,
        wallet_address: walletAddress,
      });
      if (insErr) throw insErr;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // 4) JWT de session Supabase
    const token = signSupabaseJwt(userId, walletAddress);

    return NextResponse.json({ token, profile });
  } catch (e) {
    console.error("[auth/verify]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
