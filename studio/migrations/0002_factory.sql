-- Content Factory (implementations/IMPLEMENTATION_FABRICA_DE_CONTEUDO.md)
-- A Factory não cria base paralela: tudo que ela gera entra em recipes / ingredients / assets / batches.
-- Estas tabelas só guardam a linha de produção (templates, jobs, eventos, itens) e a proveniência.

CREATE TABLE generation_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('recipe', 'recipe_image', 'ingredient_image', 'description', 'metadata')),
  version     TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (name, version)
);

CREATE TABLE generation_jobs (
  id                TEXT PRIMARY KEY,
  seq               INTEGER NOT NULL UNIQUE,            -- exibido como #GF-102
  type              TEXT NOT NULL CHECK (type IN ('recipe', 'recipe_image', 'ingredient_image', 'description', 'metadata')),
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'disabled')),
  batch_id          TEXT REFERENCES batches (id),
  template_id       TEXT REFERENCES generation_templates (id),
  template_version  TEXT,
  provider          TEXT,
  model             TEXT,
  idempotency_key   TEXT UNIQUE,                        -- clique duplicado não cria dois jobs
  target_type       TEXT,                               -- recipe | ingredient (jobs de imagem / regeneração)
  target_id         TEXT,
  input_payload     TEXT NOT NULL DEFAULT '{}',
  output_payload    TEXT,                               -- resumo estruturado
  raw_output        TEXT,                               -- saída bruta do provider: nunca é perdida
  error_kind        TEXT CHECK (error_kind IN ('external', 'structural', 'blocked')),
  error_message     TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  items_count       INTEGER NOT NULL DEFAULT 0,
  estimated_cost    REAL NOT NULL DEFAULT 0,
  actual_cost       REAL NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  created_by        TEXT,
  created_at        TEXT NOT NULL,
  started_at        TEXT,
  completed_at      TEXT
);
CREATE INDEX idx_gjobs_status ON generation_jobs (status, created_at);
CREATE INDEX idx_gjobs_batch ON generation_jobs (batch_id);
CREATE INDEX idx_gjobs_target ON generation_jobs (type, target_id);

CREATE TABLE generation_events (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES generation_jobs (id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  message     TEXT NOT NULL,
  data        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_gevents_job ON generation_events (job_id, created_at);

-- Cada receita gerada num job de receitas. 'pending' = esperando decisão humana.
CREATE TABLE generation_items (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES generation_jobs (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  outcome     TEXT NOT NULL CHECK (outcome IN ('created', 'duplicate', 'needs_decision', 'invalid', 'discarded', 'error')),
  recipe_id   TEXT REFERENCES recipes (id),
  payload     TEXT NOT NULL,                            -- receita gerada, normalizada (JSON)
  details     TEXT NOT NULL DEFAULT '{}',               -- duplicados, ingredientes indecisos, cobertura de assets, erros
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_gitems_job ON generation_items (job_id, position);
CREATE INDEX idx_gitems_recipe ON generation_items (recipe_id);

-- Lotes criados pela Factory são identificáveis.
ALTER TABLE batches ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Proveniência (§26): manual | generated | imported
ALTER TABLE recipes ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE recipes ADD COLUMN source_job_id TEXT;
ALTER TABLE recipes ADD COLUMN template_version TEXT;
ALTER TABLE recipes ADD COLUMN provider TEXT;
ALTER TABLE recipes ADD COLUMN model TEXT;
ALTER TABLE recipes ADD COLUMN generated_at TEXT;
ALTER TABLE recipes ADD COLUMN approved_by TEXT;
ALTER TABLE recipes ADD COLUMN approved_at TEXT;

-- Rastreabilidade de imagens geradas (§19)
ALTER TABLE assets ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE assets ADD COLUMN generation_template_id TEXT;
ALTER TABLE assets ADD COLUMN generation_template_version TEXT;
ALTER TABLE assets ADD COLUMN provider TEXT;
ALTER TABLE assets ADD COLUMN model TEXT;
ALTER TABLE assets ADD COLUMN prompt TEXT;
