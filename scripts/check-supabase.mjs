/**
 * Vérifie que Supabase est correctement branché :
 *   - les 4 variables d'environnement sont présentes (et pas des placeholders)
 *   - la connexion service_role fonctionne
 *   - les 4 tables existent (schéma appliqué)
 *   - la lecture publique des profils (RLS) fonctionne côté anon
 *
 *   npm run check:supabase
 *
 * Aucun secret n'est affiché ni transmis : tout est lu localement depuis .env.local.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

// --- Charge .env.local -------------------------------------------------------
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("❌ .env.local introuvable. Copie .env.local.example vers .env.local d'abord.");
  process.exit(1);
}

const ok = (s) => console.log(`  ✅ ${s}`);
const ko = (s) => console.log(`  ❌ ${s}`);

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
};

const isSet = (v) => Boolean(v) && !String(v).toLowerCase().includes("placeholder");

console.log("\n--- Variables d'environnement ---");
let missing = false;
for (const [k, v] of Object.entries(vars)) {
  if (isSet(v)) ok(`${k} défini`);
  else {
    ko(`${k} manquant ou placeholder`);
    missing = true;
  }
}
if (missing) {
  console.error(
    "\n⛔ Renseigne les 4 clés dans .env.local (voir README §4), puis relance.\n"
  );
  process.exit(1);
}

const admin = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("\n--- Tables (schéma appliqué ?) ---");
  const tables = ["profiles", "conversations", "messages", "reward_logs"];
  let schemaOk = true;
  for (const t of tables) {
    const { error, count } = await admin.from(t).select("*", { count: "exact", head: true });
    if (error) {
      ko(`${t} — ${error.message}`);
      schemaOk = false;
    } else {
      ok(`${t} (${count ?? 0} lignes)`);
    }
  }
  if (!schemaOk) {
    console.error(
      "\n⛔ Des tables manquent. Exécute supabase/schema.sql dans le SQL Editor Supabase.\n"
    );
    process.exit(1);
  }

  console.log("\n--- RLS (lecture publique des profils côté anon) ---");
  const { error: anonErr } = await anon.from("profiles").select("id", { head: true, count: "exact" });
  if (anonErr) ko(`lecture anon refusée — ${anonErr.message}`);
  else ok("lecture publique des profils OK");

  // On forge un JWT comme le fait /api/auth/verify, et on tape une requête
  // authentifiée : si le secret est bon, PostgREST accepte la session.
  console.log("\n--- JWT Secret (auth Phantom) ---");
  const testToken = jwt.sign(
    { sub: randomUUID(), role: "authenticated", aud: "authenticated" },
    vars.SUPABASE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );
  const authed = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${testToken}` } },
  });
  const { error: jwtErr } = await authed
    .from("reward_logs")
    .select("id", { head: true, count: "exact" });
  if (jwtErr) {
    ko(`session refusée — ${jwtErr.message}`);
    console.error(
      "\n⛔ Le JWT Secret ne correspond pas. Copie la valeur exacte du\n" +
        "   \"Legacy JWT Secret\" (Settings > JWT Keys) dans SUPABASE_JWT_SECRET.\n"
    );
    process.exit(1);
  }
  ok("JWT Secret valide (session authentifiée acceptée)");

  console.log("\n🎉 Supabase est branché et opérationnel. Lance `npm run dev`.\n");
}

main().catch((e) => {
  console.error("\n❌ Connexion échouée :", e.message ?? e);
  console.error("   Vérifie NEXT_PUBLIC_SUPABASE_URL et les clés dans .env.local.\n");
  process.exit(1);
});
