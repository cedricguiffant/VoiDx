/**
 * Crée le token SPL "VOID" sur devnet (équivalent des commandes spl-token CLI,
 * mais en Node — multiplateforme, avec les libs déjà installées).
 *
 *   node scripts/create-token.mjs
 *
 * Produit :
 *   - une keypair de trésor (mint authority) : ~/voidx-treasury.json  [SECRET]
 *   - un mint 9 décimales, 1 000 000 000 de tokens émis vers le trésor
 *   - l'adresse du mint écrite dans ~/voidx-token-mint.txt
 *
 * À reporter ensuite dans .env.local : NEXT_PUBLIC_TOKEN_MINT=<adresse>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const DECIMALS = 9;
const SUPPLY = 1_000_000_000n; // 1 milliard de tokens (en unités entières)
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");

const KEYPAIR_PATH = join(homedir(), "voidx-treasury.json");
const MINT_PATH = join(homedir(), "voidx-token-mint.txt");

const log = (s) => console.log(s);

// --- 1) Keypair du trésor (réutilisée si déjà présente) ----------------------
function loadOrCreateTreasury() {
  if (existsSync(KEYPAIR_PATH)) {
    const secret = Uint8Array.from(JSON.parse(readFileSync(KEYPAIR_PATH, "utf8")));
    log(`🔑 Trésor existant réutilisé : ${KEYPAIR_PATH}`);
    return Keypair.fromSecretKey(secret);
  }
  const kp = Keypair.generate();
  // Format compatible CLI Solana (tableau de 64 octets).
  writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
  log(`🔑 Nouveau trésor créé : ${KEYPAIR_PATH}  (⚠️ garde ce fichier en sécurité)`);
  return kp;
}

async function ensureFunds(connection, treasury) {
  let balance = await connection.getBalance(treasury.publicKey);
  if (balance >= 0.5 * LAMPORTS_PER_SOL) return true;

  log("💧 Solde insuffisant, demande d'airdrop devnet…");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const sig = await connection.requestAirdrop(treasury.publicKey, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      balance = await connection.getBalance(treasury.publicKey);
      if (balance >= 0.5 * LAMPORTS_PER_SOL) {
        log(`   ✅ Airdrop OK (solde: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
        return true;
      }
    } catch (e) {
      log(`   ⚠️ Tentative ${attempt}/3 échouée : ${e.message ?? e}`);
    }
  }
  return false;
}

async function main() {
  log(`\n🌐 Réseau : ${RPC}`);
  const connection = new Connection(RPC, "confirmed");
  const treasury = loadOrCreateTreasury();
  log(`   Trésor (pubkey) : ${treasury.publicKey.toBase58()}`);

  // Si un mint a déjà été créé pour ce trésor, on ne recrée pas.
  if (existsSync(MINT_PATH)) {
    const existing = readFileSync(MINT_PATH, "utf8").trim();
    log(`\nℹ️ Un mint existe déjà : ${existing}`);
    log("   (supprime ~/voidx-token-mint.txt pour en recréer un autre)");
    return;
  }

  const funded = await ensureFunds(connection, treasury);
  if (!funded) {
    log(
      "\n⛔ Impossible d'obtenir du SOL devnet (faucet saturé).\n" +
        `   Alimente cette adresse via https://faucet.solana.com :\n` +
        `   ${treasury.publicKey.toBase58()}\n` +
        "   puis relance : node scripts/create-token.mjs\n"
    );
    process.exit(1);
  }

  // --- 2) Créer le mint ------------------------------------------------------
  log("\n🏭 Création du mint…");
  const mint = await createMint(
    connection,
    treasury, // payeur des frais
    treasury.publicKey, // mint authority
    null, // freeze authority (aucune)
    DECIMALS
  );
  log(`   ✅ Mint : ${mint.toBase58()}`);

  // --- 3) Compte-trésor (ATA) ------------------------------------------------
  log("💼 Création du compte-trésor (ATA)…");
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey
  );

  // --- 4) Émettre la réserve -------------------------------------------------
  const baseUnits = SUPPLY * 10n ** BigInt(DECIMALS);
  log(`🪙 Émission de ${SUPPLY.toLocaleString("en-US")} tokens…`);
  await mintTo(connection, treasury, mint, ata.address, treasury, baseUnits);

  writeFileSync(MINT_PATH, mint.toBase58());

  log("\n────────────────────────────────────────────");
  log(`🎉 Token VOID créé sur devnet`);
  log(`   TOKEN_MINT : ${mint.toBase58()}`);
  log(`   Supply     : ${SUPPLY.toLocaleString("en-US")} (9 décimales)`);
  log(`   Explorer   : https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`);
  log("────────────────────────────────────────────");
  log(`\n➡️  Ajoute dans .env.local :`);
  log(`   NEXT_PUBLIC_TOKEN_MINT=${mint.toBase58()}\n`);
}

main().catch((e) => {
  console.error("\n❌ Échec :", e.message ?? e);
  process.exit(1);
});
