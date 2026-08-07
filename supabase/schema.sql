-- =====================================================================
--  VoiDx — Schéma Supabase (Postgres) + RLS + fonctions récompenses
--  À exécuter dans : Supabase Dashboard > SQL Editor
-- =====================================================================

-- Extensions utiles
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  TABLE : profiles
--  id = UUID déterministe dérivé du wallet (voir src/lib/auth/userId.ts),
--  utilisé comme `sub` du JWT => auth.uid() correspond à profiles.id.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key,
  wallet_address text unique not null,
  username       text,
  bio            text,
  interests      text[] not null default '{}',
  language       text not null default 'fr',
  is_anonymous   boolean not null default false,
  token_balance  bigint not null default 0,     -- token virtuel (entier)
  onboarded      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_interests_idx on public.profiles using gin (interests);
create index if not exists profiles_language_idx  on public.profiles (language);

-- ---------------------------------------------------------------------
--  TABLE : conversations
--  On stocke toujours (participant1 < participant2) pour éviter les doublons.
--  is_new_connection : true tant que la conversation est "nouvelle".
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  participant1      uuid not null references public.profiles(id) on delete cascade,
  participant2      uuid not null references public.profiles(id) on delete cascade,
  is_new_connection boolean not null default true,
  message_count     int not null default 0,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  constraint conversations_distinct check (participant1 <> participant2),
  constraint conversations_ordered  check (participant1 < participant2),
  constraint conversations_unique_pair unique (participant1, participant2)
);

create index if not exists conversations_p1_idx on public.conversations (participant1);
create index if not exists conversations_p2_idx on public.conversations (participant2);

-- ---------------------------------------------------------------------
--  TABLE : messages
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
--  TABLE : reward_logs
-- ---------------------------------------------------------------------
create table if not exists public.reward_logs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  amount                 bigint not null,
  reason                 text not null,          -- 'new_connection' | 'regular_conversation'
  related_conversation_id uuid references public.conversations(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists reward_logs_user_idx on public.reward_logs (user_id, created_at desc);

-- =====================================================================
--  FONCTION : award_reward (SECURITY DEFINER)
--  Attribution atomique : insère un log + incrémente token_balance.
--  Applique un plafond journalier (anti-abus) et évite les doublons
--  pour une même (conversation, raison, jour).
-- =====================================================================
create or replace function public.award_reward(
  p_user_id uuid,
  p_amount  bigint,
  p_reason  text,
  p_conversation_id uuid,
  p_daily_cap bigint default 500
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_total bigint;
  v_already     int;
begin
  -- Anti-doublon : une seule récompense par (user, conversation, raison, jour)
  select count(*) into v_already
  from public.reward_logs
  where user_id = p_user_id
    and reason = p_reason
    and related_conversation_id is not distinct from p_conversation_id
    and created_at >= date_trunc('day', now());

  if v_already > 0 then
    return 0; -- déjà récompensé aujourd'hui pour ce motif/conversation
  end if;

  -- Plafond journalier
  select coalesce(sum(amount), 0) into v_today_total
  from public.reward_logs
  where user_id = p_user_id
    and created_at >= date_trunc('day', now());

  if v_today_total + p_amount > p_daily_cap then
    return 0; -- plafond atteint
  end if;

  insert into public.reward_logs (user_id, amount, reason, related_conversation_id)
  values (p_user_id, p_amount, p_reason, p_conversation_id);

  update public.profiles
  set token_balance = token_balance + p_amount,
      updated_at = now()
  where id = p_user_id;

  return p_amount;
end;
$$;

-- =====================================================================
--  TRIGGER : maj compteur / last_message_at à chaque message
-- =====================================================================
create or replace function public.on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set message_count = message_count + 1,
      last_message_at = new.created_at,
      -- au-delà de 1 message échangé, ce n'est plus une "première" connexion
      is_new_connection = case when message_count + 1 >= 2 then false else is_new_connection end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_on_new_message on public.messages;
create trigger trg_on_new_message
  after insert on public.messages
  for each row execute function public.on_new_message();

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.reward_logs   enable row level security;

-- PROFILES ------------------------------------------------------------
-- Lecture publique (nécessaire pour la découverte). Le front masque
-- le wallet si is_anonymous. On ne renvoie jamais d'info sensible ici.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- CONVERSATIONS -------------------------------------------------------
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member"
  on public.conversations for select
  using (auth.uid() = participant1 or auth.uid() = participant2);

drop policy if exists "conversations_insert_member" on public.conversations;
create policy "conversations_insert_member"
  on public.conversations for insert
  with check (auth.uid() = participant1 or auth.uid() = participant2);

-- MESSAGES ------------------------------------------------------------
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.participant1 or auth.uid() = c.participant2)
    )
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.participant1 or auth.uid() = c.participant2)
    )
  );

-- REWARD LOGS ---------------------------------------------------------
-- Lecture : seulement les siens. Écriture : uniquement via award_reward
-- (SECURITY DEFINER) ou service_role — pas d'INSERT direct client.
drop policy if exists "reward_logs_select_self" on public.reward_logs;
create policy "reward_logs_select_self"
  on public.reward_logs for select
  using (auth.uid() = user_id);

-- =====================================================================
--  REALTIME : publier messages + conversations
-- =====================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
