-- À coller dans Supabase : SQL Editor > New query > Run.
-- Une seule table, chaque utilisateur ne voit que ses propres lignes (RLS).

create table if not exists public.tasks (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text     text not null,
  done     boolean not null default false,
  t        text not null check (t in ('day','week','month','quarter','year')),
  k        text not null,
  o        double precision not null default 0,   -- ordre d'affichage
  u        bigint not null,                        -- date de modification côté appareil (ms)
  x        boolean not null default false,         -- supprimée
  s        jsonb   not null default '[]',          -- sous-tâches [{id,text,done}]
  c        text    not null default '',            -- surlignage (y, p, g, b, v ou vide)
  b        text    not null default '',            -- créneau (planning) auquel la tâche est assignée
  ts       timestamptz not null default now()      -- date de réception côté serveur
);

-- Base créée avant les sous-tâches et le surlignage : ces deux lignes suffisent.
alter table public.tasks add column if not exists s jsonb not null default '[]';
alter table public.tasks add column if not exists c text not null default '';
-- Base créée avant le planning : cette ligne + la table blocks plus bas.
alter table public.tasks add column if not exists b text not null default '';

create index if not exists tasks_user_ts on public.tasks (user_id, ts);

alter table public.tasks enable row level security;

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Dernier écrit gagne : un envoi plus ancien que la ligne déjà enregistrée est ignoré
-- (un appareil resté hors ligne ne peut pas écraser une modification plus récente).
create or replace function public.touch_ts() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.u < old.u then
    return old;
  end if;
  new.ts = now();
  return new;
end $$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.touch_ts();

-- Planning (time blocking) : créneaux horaires d'un jour. a et e = minutes depuis minuit.
create table if not exists public.blocks (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  k        text not null,                          -- jour (AAAA-MM-JJ)
  a        integer not null,                       -- début
  e        integer not null,                       -- fin
  u        bigint not null,
  x        boolean not null default false,
  ts       timestamptz not null default now()
);
create index if not exists blocks_user_ts on public.blocks (user_id, ts);
alter table public.blocks enable row level security;
drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop trigger if exists blocks_touch on public.blocks;
create trigger blocks_touch before insert or update on public.blocks
  for each row execute function public.touch_ts();

-- Notes : bloc-notes (texte brut). cr = création, u = dernière modification (ms).
create table if not exists public.notes (
  id       text primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text     text not null default '',
  cr       bigint not null,
  u        bigint not null,
  x        boolean not null default false,
  ts       timestamptz not null default now()
);
create index if not exists notes_user_ts on public.notes (user_id, ts);
alter table public.notes enable row level security;
drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before insert or update on public.notes
  for each row execute function public.touch_ts();
