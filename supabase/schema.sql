-- Receita da Hora — schema PostgreSQL (Supabase)
-- O app roda local-first (localStorage). Este schema é o alvo da persistência em nuvem:
-- troque as funções de src/services/storage.ts por chamadas ao Supabase mantendo a mesma interface.

create table if not exists profiles (
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
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipes (
  id text primary key,
  slug text unique not null,
  title text not null,
  description text not null,
  image_url text not null default '',
  prep_time_minutes int not null,
  servings int not null,
  cuisine text not null,
  meal_types text[] not null,
  dietary_tags text[] not null default '{}',
  ingredients_tags text[] not null default '{}',
  nutrition jsonb,
  traits jsonb not null,
  weather_affinity jsonb not null,
  palette jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  recipe_id text not null references recipes (id) on delete cascade,
  position int not null,
  item text not null,
  quantity numeric not null,
  unit text not null,
  optional boolean not null default false,
  primary key (recipe_id, position)
);

create table if not exists recipe_steps (
  recipe_id text not null references recipes (id) on delete cascade,
  number int not null,
  instruction text not null,
  primary key (recipe_id, number)
);

create table if not exists saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references recipes (id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create table if not exists recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references recipes (id) on delete cascade,
  type text not null check (type in ('liked', 'disliked')),
  reason text check (reason in ('too-slow', 'too-heavy', 'ingredients', 'not-now')),
  context_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references recipes (id) on delete cascade,
  event_type text not null check (event_type in (
    'recipe_shown', 'recipe_opened', 'recipe_skipped', 'recipe_saved',
    'recipe_liked', 'recipe_disliked', 'recipe_cooked'
  )),
  created_at timestamptz not null default now()
);

create index if not exists saved_recipes_user_saved_at on saved_recipes (user_id, saved_at);
create index if not exists recipe_feedback_user_created on recipe_feedback (user_id, created_at);
create index if not exists recommendation_events_user_created on recommendation_events (user_id, created_at);
create index if not exists recipes_active_id on recipes (active, id);

-- RLS: cada pessoa só enxerga e altera os próprios dados. Receitas são leitura pública.
alter table profiles enable row level security;
alter table saved_recipes enable row level security;
alter table recipe_feedback enable row level security;
alter table recommendation_events enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;

create policy "recipes são públicas" on recipes for select using (active);
create policy "ingredientes públicos" on recipe_ingredients for select using (true);
create policy "passos públicos" on recipe_steps for select using (true);

create policy "perfil: próprio" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "salvas: próprias" on saved_recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "feedback: próprio" on recipe_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "eventos: leitura/inserção própria" on recommendation_events for select
  using (auth.uid() = user_id);
create policy "eventos: inserção própria" on recommendation_events for insert
  with check (auth.uid() = user_id);

-- Direito ao esquecimento (LGPD): apagar o usuário em auth.users remove tudo em cascata.
