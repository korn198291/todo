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
  ts       timestamptz not null default now()      -- date de réception côté serveur
);

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
