/**
 * Attache (ou met à jour) les métadonnées Metaplex du token VOID :
 * nom "VoidX", symbole "VOID", et un lien vers le JSON hébergé (image + desc).
 *
 *   node scripts/set-token-metadata.mjs
 *
 * Signé par le trésor (mint + update authority). Idempotent : si les
 * métadonnées existent déjà, on les met à jour au lieu de recréer.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import mtm from "@metaplex-foundation/mpl-token-metadata";

const {
  PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  createUpdateMetadataAccountV2Instruction,
} = mtm;

// --- Paramètres --------------------------------------------------------------
const MINT = process.env.NEXT_PUBLIC_TOKEN_MINT || "HhLZrfLwMhBrHouzc8PKJTZaYoc2zssocxEnHTN1wADb";
const NAME = "VoidX";
const SYMBOL = "VOID";
const URI = process.env.TOKEN_METADATA_URI || "https://voi-dx.vercel.app/voidx-token.json";
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
const KEYPAIR_PATH = process.env.TREASURY_KEYPAIR_PATH || join(homedir(), "voidx-treasury.json");

async function main() {
  const treasury = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(KEYPAIR_PATH, "utf8")))
  );
  const connection = new Connection(RPC, "confirmed");
  const mint = new PublicKey(MINT);

  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), PROGRAM_ID.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );

  const data = {
    name: NAME,
    symbol: SYMBOL,
    uri: URI,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const existing = await connection.getAccountInfo(metadataPDA);

  let ix;
  if (existing) {
    console.log("ℹ️ Métadonnées existantes -> mise à jour");
    ix = createUpdateMetadataAccountV2Instruction(
      { metadata: metadataPDA, updateAuthority: treasury.publicKey },
      {
        updateMetadataAccountArgsV2: {
          data,
          updateAuthority: treasury.publicKey,
          primarySaleHappened: null,
          isMutable: true,
        },
      }
    );
  } else {
    console.log("🆕 Création des métadonnées");
    ix = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint,
        mintAuthority: treasury.publicKey,
        payer: treasury.publicKey,
        updateAuthority: treasury.publicKey,
      },
      {
        createMetadataAccountArgsV3: { data, isMutable: true, collectionDetails: null },
      }
    );
  }

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);

  console.log("\n────────────────────────────────────────────");
  console.log(`✅ Métadonnées ${existing ? "mises à jour" : "créées"}`);
  console.log(`   Nom      : ${NAME}`);
  console.log(`   Symbole  : ${SYMBOL}`);
  console.log(`   URI      : ${URI}`);
  console.log(`   Signature: ${sig}`);
  console.log(`   Explorer : https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log("────────────────────────────────────────────\n");
}

main().catch((e) => {
  console.error("❌ Échec :", e.message ?? e);
  process.exit(1);
});
