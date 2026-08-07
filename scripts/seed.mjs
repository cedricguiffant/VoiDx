/**
 * Seed de données de démo pour VoiDx.
 *
 *   node scripts/seed.mjs                 -> insère ~10 profils fictifs
 *   node scripts/seed.mjs < tonWallet >   -> + une conversation de démo avec
 *                                            des messages entrants pour CE wallet
 *
 * Nécessite un vrai projet Supabase configuré dans .env.local
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Idempotent : les profils sont dérivés de wallets déterministes -> upsert.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";
import { v5 as uuidv5 } from "uuid";

// --- Charge .env.local (Node ne le fait pas pour un script hors Next) --------
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env.local : on tentera avec l'environnement courant */
}

// Même namespace que src/lib/auth/userId.ts -> ids cohérents avec l'app.
const NAMESPACE = "d87466f6-5626-422c-9b98-ff2e98fa69cc";
const walletToUserId = (addr) => uuidv5(addr.trim(), NAMESPACE);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("placeholder") || serviceKey.includes("placeholder")) {
  console.error(
    "\n❌ Supabase non configuré.\n" +
      "   Renseigne NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local\n" +
      "   (valeurs réelles, pas les placeholders), puis relance : npm run seed\n"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Profils fictifs ---------------------------------------------------------
const DEMO_PROFILES = [
  { username: "nova_42", bio: "Late nights and lo-fi playlists. Talk to me about music.", interests: ["music", "lo-fi", "astronomy"], language: "en", is_anonymous: false },
  { username: "kai_wanders", bio: "Backpacker just back from Asia. I collect stories.", interests: ["travel", "photography", "cooking"], language: "en", is_anonymous: false },
  { username: "luna", bio: "Illustrator. Tea, cats, and long conversations.", interests: ["drawing", "art", "tea"], language: "en", is_anonymous: false },
  { username: "mateo_dev", bio: "I build little games on weekends. Quiet but chatty.", interests: ["video games", "code", "sci-fi"], language: "es", is_anonymous: false },
  { username: "sora", bio: "", interests: ["anime", "hiking", "music"], language: "en", is_anonymous: true },
  { username: "amelie_b", bio: "Yoga teacher. I love people who ask real questions.", interests: ["yoga", "reading", "meditation"], language: "fr", is_anonymous: false },
  { username: "theo", bio: "Into football and terrible puns.", interests: ["sports", "football", "humor"], language: "fr", is_anonymous: false },
  { username: "yuki_snow", bio: "New in town, looking to meet calm people.", interests: ["reading", "coffee", "cinema"], language: "en", is_anonymous: false },
  { username: "diego", bio: "Amateur guitarist, open to anything.", interests: ["music", "guitar", "travel"], language: "es", is_anonymous: false },
  { username: "anon_owl", bio: "", interests: ["philosophy", "night", "writing"], language: "en", is_anonymous: true },
];

async function seedProfiles() {
  const rows = DEMO_PROFILES.map((p, i) => {
    // Wallet déterministe (Keypair.fromSeed) -> même adresse à chaque run.
    const kp = Keypair.fromSeed(Uint8Array.from({ length: 32 }, () => (i + 1) % 256));
    const wallet = kp.publicKey.toBase58();
    return {
      id: walletToUserId(wallet),
      wallet_address: wallet,
      username: p.username,
      bio: p.bio || null,
      interests: p.interests,
      language: p.language,
      is_anonymous: p.is_anonymous,
      token_balance: Math.floor(Math.random() * 300),
      onboarded: true,
    };
  });

  const { error } = await admin.from("profiles").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`✅ ${rows.length} profils de démo insérés / mis à jour.`);
  return rows;
}

async function seedConversation(myWallet, demoRows) {
  const myId = walletToUserId(myWallet);

  // Le profil de l'utilisateur doit déjà exister (connecte-toi une fois d'abord).
  const { data: me } = await admin.from("profiles").select("id").eq("id", myId).maybeSingle();
  if (!me) {
    console.warn(
      `⚠️  Aucun profil pour ${myWallet}. Connecte-toi une première fois dans l'app,\n` +
        "    puis relance avec ton wallet pour créer la conversation de démo."
    );
    return;
  }

  const peer = demoRows[0]; // nova_42
  const [participant1, participant2] = [myId, peer.id].sort();

  // Upsert conversation (paire unique).
  const { data: convo, error: cErr } = await admin
    .from("conversations")
    .upsert(
      { participant1, participant2 },
      { onConflict: "participant1,participant2" }
    )
    .select("id")
    .single();
  if (cErr) throw cErr;

  // Quelques messages entrants (du profil de démo) + une réponse de l'utilisateur.
  const now = Date.now();
  const script = [
    { from: peer.id, text: "Hey! I saw we both like music 🎧" },
    { from: peer.id, text: "What are you listening to these days?" },
    { from: myId, text: "Hi! Lots of lo-fi actually 😅" },
    { from: peer.id, text: "Perfect, I've got a playlist to share with you then." },
  ];
  const messages = script.map((m, i) => ({
    conversation_id: convo.id,
    sender_id: m.from,
    content: m.text,
    created_at: new Date(now - (script.length - i) * 60000).toISOString(),
  }));

  const { error: mErr } = await admin.from("messages").insert(messages);
  if (mErr) throw mErr;

  console.log(`✅ Conversation de démo créée avec ${peer.username} (${messages.length} messages).`);
}

async function main() {
  const demoRows = await seedProfiles();
  const myWallet = process.argv[2];
  if (myWallet) await seedConversation(myWallet, demoRows);
  console.log("\n🎉 Seed terminé. Va sur /discover.");
}

main().catch((e) => {
  console.error("❌ Échec du seed :", e.message ?? e);
  process.exit(1);
});
