-- Receita da Hora Studio — schema inicial (D1 / SQLite)
-- IDs próprios (nunca o nome visível): recipe_…, ingredient_…, asset_…, batch_…

CREATE TABLE batches (
  id            TEXT PRIMARY KEY,
  number        INTEGER NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  created_at    TEXT NOT NULL,
  completed_at  TEXT
);

-- Metadados dos arquivos. O binário vive no R2; aqui só chave, versão e status.
CREATE TABLE assets (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('recipe_hero', 'ingredient', 'brand', 'ui')),
  owner_id    TEXT,                      -- recipe_… ou ingredient_… (null para brand/ui)
  r2_key      TEXT NOT NULL UNIQUE,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  version     INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'approved', 'rejected')),
  reject_reason TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX idx_assets_owner ON assets (owner_id, type, version);
CREATE INDEX idx_assets_status ON assets (status);

-- Entidade global reutilizável: todas as receitas que usam "tomate" apontam para a mesma linha.
CREATE TABLE ingredients (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  normalized_name  TEXT NOT NULL,
  asset_id         TEXT REFERENCES assets (id),   -- versão atual do asset
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE UNIQUE INDEX idx_ingredients_normalized ON ingredients (normalized_name) WHERE deleted_at IS NULL;

CREATE TABLE ingredient_aliases (
  id               TEXT PRIMARY KEY,
  ingredient_id    TEXT NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
  alias            TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_aliases_ingredient ON ingredient_aliases (ingredient_id);

CREATE TABLE recipes (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,   -- editável sem quebrar relacionamentos
  description         TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL DEFAULT '',
  prep_time           INTEGER NOT NULL DEFAULT 0,   -- minutos
  cook_time           INTEGER NOT NULL DEFAULT 0,
  servings            INTEGER NOT NULL DEFAULT 1,
  difficulty          TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  instructions        TEXT NOT NULL DEFAULT '[]',   -- JSON: string[]
  tags                TEXT NOT NULL DEFAULT '[]',   -- JSON: string[]
  visual_ingredients  TEXT NOT NULL DEFAULT '[]',   -- JSON: string[] (Recipe Photography System §9)
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'image_pending', 'review', 'approved', 'published', 'rejected')),
  reject_reason       TEXT,
  batch_id            TEXT REFERENCES batches (id),
  hero_asset_id       TEXT REFERENCES assets (id),  -- versão ativa da imagem principal
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  published_at        TEXT,
  deleted_at          TEXT
);
CREATE INDEX idx_recipes_status ON recipes (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_recipes_batch ON recipes (batch_id);
CREATE INDEX idx_recipes_category ON recipes (category);

CREATE TABLE recipe_ingredients (
  id             TEXT PRIMARY KEY,
  recipe_id      TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  ingredient_id  TEXT NOT NULL REFERENCES ingredients (id),
  quantity       REAL,               -- null = "a gosto"
  unit           TEXT NOT NULL DEFAULT '',
  note           TEXT NOT NULL DEFAULT '',
  raw_name       TEXT NOT NULL DEFAULT '',   -- como veio na receita ("tomate fresco")
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id, sort_order);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients (ingredient_id);
