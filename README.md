# VoiDx

Application web qui relie des personnes isolées via matching + chat, et récompense
les échanges avec un token virtuel **VOID** (préparé pour un futur claim SPL sur Solana).

**Stack :** Next.js 14 (App Router) · TypeScript · Tailwind + shadcn-style · Supabase
(Auth/Postgres/Realtime) · @solana/wallet-adapter (Phantom) · Zustand · Lucide.

---

## 1. Prérequis

- Node.js 18+
- Un projet [Supabase](https://supabase.com) (gratuit)
- L'extension navigateur **Phantom**

## 2. Installation

```bash
npm install
```

## 3. Base de données Supabase

1. Crée un projet sur Supabase.
2. Ouvre **SQL Editor** et exécute l'intégralité de [`supabase/schema.sql`](supabase/schema.sql).
   Cela crée les tables (`profiles`, `conversations`, `messages`, `reward_logs`),
   les policies **RLS**, la fonction d'attribution `award_reward`, les triggers,
   et active **Realtime** sur `messages` / `conversations`.

## 4. Variables d'environnement

Copie l'exemple puis remplis les valeurs :

```bash
cp .env.local.example .env.local
```

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role (**secret**) |
| `SUPABASE_JWT_SECRET` | Supabase > Settings > API > JWT Secret |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` (défaut) / `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_RPC` | RPC Solana (défaut : cluster public) |
| `NEXT_PUBLIC_TOKEN_MINT` | (vide tant que le token SPL n'est pas déployé) |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_JWT_SECRET` sont **serveur uniquement**
> (utilisés dans les routes `/api/*`). Ne jamais les préfixer `NEXT_PUBLIC_`.

## 5. Lancer

```bash
npm run dev
```

Ouvre http://localhost:3000, connecte Phantom, signe le message, complète ton profil.

---

## Comment marche l'authentification

Supabase n'a pas de "Sign-In With Solana" natif. Le flux implémenté :

1. `/api/auth/nonce` renvoie un message à signer (nonce + date).
2. Phantom signe le message côté client.
3. `/api/auth/verify` vérifie la signature (tweetnacl), **upsert** le profil
   (id = UUID déterministe dérivé du wallet), puis **forge un JWT Supabase**
   signé avec `SUPABASE_JWT_SECRET`.
4. Le client applique ce JWT via `supabase.auth.setSession` → `auth.uid()`
   fonctionne dans les policies RLS.

## Système de récompenses

Barème centralisé dans [`src/lib/constants.ts`](src/lib/constants.ts) :

- **+50 VOID** pour une conversation avec une **nouvelle personne** (une fois / conversation).
- **+10 VOID** pour une **conversation régulière** (≥ 5 messages sur 7 jours, une fois / jour).
- **Plafond journalier** de 500 VOID (anti-abus), appliqué aussi côté SQL dans `award_reward`.

L'attribution est déclenchée après chaque envoi de message via `/api/rewards`,
et reste **idempotente** (anti-doublon en base).

## Claim on-chain (futur)

[`src/lib/solana.ts`](src/lib/solana.ts) contient le squelette commenté du claim
SPL. Il s'active automatiquement quand `NEXT_PUBLIC_TOKEN_MINT` est renseigné.

## Structure

```
src/
  app/            pages (App Router) + routes /api
  components/     ui/ (shadcn-style), chat/, wallet/, layout/, providers/
  lib/            supabase/, auth/, rewards, constants, solana, utils
  store/          Zustand (session + profil)
  types/          types DB
supabase/schema.sql  schéma + RLS + fonctions
```
