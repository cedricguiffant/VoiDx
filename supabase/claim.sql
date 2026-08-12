-- =====================================================================
--  VoiDx — Claim on-chain (à exécuter dans Supabase SQL Editor)
--  Ajoute la table `claims` + les fonctions atomiques de claim/refund.
--  (Déjà inclus dans schema.sql pour les nouveaux déploiements.)
-- =====================================================================

-- Journal des claims (une ligne par tentative).
create table if not exists public.claims (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        bigint not null check (amount > 0),   -- en points VOID
  status        text not null default 'pending',      -- pending | completed | failed
  tx_signature  text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists claims_user_idx on public.claims (user_id, created_at desc);

alter table public.claims enable row level security;

drop policy if exists "claims_select_self" on public.claims;
create policy "claims_select_self"
  on public.claims for select
  using (auth.uid() = user_id);
-- Pas de policy insert/update : écriture uniquement via les fonctions
-- SECURITY DEFINER ci-dessous ou le service_role.

-- ---------------------------------------------------------------------
--  claim_tokens : réserve atomique.
--  Verrouille le profil, vérifie le solde, décrémente et crée un claim
--  'pending'. Lève une exception explicite en cas de solde insuffisant.
--  Renvoie l'id du claim créé.
-- ---------------------------------------------------------------------
create or replace function public.claim_tokens(p_user_id uuid, p_amount bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance  bigint;
  v_claim_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Verrou de ligne : empêche deux claims concurrents de dépasser le solde.
  select token_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.profiles
  set token_balance = token_balance - p_amount,
      updated_at = now()
  where id = p_user_id;

  insert into public.claims (user_id, amount, status)
  values (p_user_id, p_amount, 'pending')
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

-- ---------------------------------------------------------------------
--  refund_claim : restaure le solde si le transfert on-chain échoue.
--  Idempotent : ne rembourse que si le claim est encore 'pending'.
-- ---------------------------------------------------------------------
create or replace function public.refund_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid;
  v_amount bigint;
  v_status text;
begin
  select user_id, amount, status into v_user, v_amount, v_status
  from public.claims
  where id = p_claim_id
  for update;

  if v_user is null then
    raise exception 'CLAIM_NOT_FOUND';
  end if;
  if v_status <> 'pending' then
    return; -- déjà finalisé, rien à faire
  end if;

  update public.profiles
  set token_balance = token_balance + v_amount,
      updated_at = now()
  where id = v_user;

  update public.claims
  set status = 'failed'
  where id = p_claim_id;
end;
$$;
