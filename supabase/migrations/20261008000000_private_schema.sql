-- Receita da Hora — schema PRIVADO (Supabase / PostgreSQL)
--
-- O conteúdo editorial (receitas, ingredientes, imagens) vive no Studio (Cloudflare D1/R2). Aqui ficam
-- APENAS dados da própria pessoa: perfil, salvos, feedback e eventos. Nenhuma tabela editorial, nenhuma FK para receitas
-- (uma receita despublicada não pode apagar nem bloquear o registro de quem a salvou).
--
-- Ids de feedback/eventos/salvos são gerados no cliente (crypto.randomUUID) para a migração do localStorage ser idempotente
-- (`on conflict (id) do nothing`). Aplique com: supabase db push  (ver docs/PASSO_A_PASSO_CONFIGURACAO_MANUAL.md)

/* ───────── perfil ───────── */
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  dietary_preferences text[] not null default '{}',
  excluded_ingredients text[] not null default '{}',
  allergies text[] not null default '{}',
  goals text[] not null default '{}' check (cardinality(goals) <= 3),
  usual_prep_time int,
  household_size int not null default 2 check (household_size >= 1),
  usual_meal_times text[] not null default '{lunch,dinner}',
  city text,
  country text,
  timezone text,
  weather_enabled boolean not null default true,
  -- fonte única de "já fez o onboarding" depois do login
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ───────── salvos ───────── */
create table public.saved_recipes (
  id text primary key check (char_length(id) between 1 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null check (char_length(recipe_id) between 1 and 128),
  saved_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

/* ───────── feedback ───────── */
create table public.recipe_feedback (
  id text primary key check (char_length(id) between 1 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null check (char_length(recipe_id) between 1 and 128),
  type text not null check (type in ('liked', 'disliked')),
  reason text check (reason in ('too-slow', 'too-heavy', 'ingredients', 'not-now')),
  context_snapshot jsonb not null check (pg_column_size(context_snapshot) <= 1024),
  created_at timestamptz not null default now()
);

/* ───────── eventos de recomendação ───────── */
create table public.recommendation_events (
  id text primary key check (char_length(id) between 1 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null check (char_length(recipe_id) between 1 and 128),
  event_type text not null check (event_type in (
    'recipe_shown', 'recipe_opened', 'recipe_skipped', 'recipe_saved',
    'recipe_liked', 'recipe_disliked', 'recipe_cooked'
  )),
  created_at timestamptz not null default now()
);

create index saved_recipes_user_saved_at on public.saved_recipes (user_id, saved_at);
create index recipe_feedback_user_created on public.recipe_feedback (user_id, created_at);
create index recommendation_events_user_created on public.recommendation_events (user_id, created_at);

/* ───────── perfil automático no cadastro ───────── */
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

/* ───────── RLS: cada pessoa só enxerga e altera os próprios dados ───────── */
alter table public.profiles enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.recipe_feedback enable row level security;
alter table public.recommendation_events enable row level security;

-- (select auth.uid()) em vez de auth.uid(): avaliado uma vez por consulta, não por linha.
create policy "perfil: leitura própria" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "perfil: inserção própria" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "perfil: atualização própria" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- sem delete de perfil: a exclusão de conta remove auth.users e a cascata leva tudo

create policy "salvos: leitura própria" on public.saved_recipes for select to authenticated using ((select auth.uid()) = user_id);
create policy "salvos: inserção própria" on public.saved_recipes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "salvos: remoção própria" on public.saved_recipes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "feedback: leitura própria" on public.recipe_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "feedback: inserção própria" on public.recipe_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "feedback: remoção própria" on public.recipe_feedback for delete to authenticated using ((select auth.uid()) = user_id);

-- eventos: select, insert e DELETE próprios (a pessoa pode apagar o próprio histórico — LGPD); sem update
create policy "eventos: leitura própria" on public.recommendation_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "eventos: inserção própria" on public.recommendation_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eventos: remoção própria" on public.recommendation_events for delete to authenticated using ((select auth.uid()) = user_id);

-- Nada para o papel anônimo: sem login não há acesso a nenhuma tabela.
revoke all on public.profiles, public.saved_recipes, public.recipe_feedback, public.recommendation_events from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.saved_recipes, public.recipe_feedback, public.recommendation_events to authenticated;

/* ───────── retenção ───────── */
-- 'recipe_shown' é o evento de maior volume e o de menor valor depois de alguns meses.
-- Agende a execução (pg_cron) conforme docs/PASSO_A_PASSO_CONFIGURACAO_MANUAL.md, passo "Retenção de eventos".
create function public.purge_old_events(retention_days int default 90) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare removed bigint;
begin
  delete from public.recommendation_events
   where event_type = 'recipe_shown' and created_at < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_old_events(int) from public, anon, authenticated;
