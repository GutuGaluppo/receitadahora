-- Metadados editoriais que o app Receita da Hora precisa para recomendar (plano consolidado §6.2).
-- Tudo nasce NULL = "não revisado". Só a revisão humana (PUT /api/recipes/:id/metadata) preenche e carimba.
-- allergens NULL bloqueia a publicação; '[]' significa "revisado, nenhum alérgeno declarado".

ALTER TABLE recipes ADD COLUMN legacy_ids TEXT NOT NULL DEFAULT '[]';        -- JSON string[]: ids do catálogo antigo do app
ALTER TABLE recipes ADD COLUMN meal_types TEXT;                              -- JSON: breakfast|lunch|snack|dinner
ALTER TABLE recipes ADD COLUMN dietary_tags TEXT;                            -- JSON: vegetarian|vegan|lactose-free|gluten-free
ALTER TABLE recipes ADD COLUMN allergens TEXT;                               -- JSON string[]; NULL = não revisado
ALTER TABLE recipes ADD COLUMN ingredients_tags TEXT;                        -- JSON string[]; [0] = ingrediente principal
ALTER TABLE recipes ADD COLUMN cuisine TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN traits TEXT;                                  -- JSON {comfort,lightness,protein,cost,novelty} 0..100
ALTER TABLE recipes ADD COLUMN weather_affinity TEXT;                        -- JSON {hot,mild,cold,rainy} 0..100
ALTER TABLE recipes ADD COLUMN palette_key TEXT;
ALTER TABLE recipes ADD COLUMN nutrition TEXT;                               -- JSON {calories?,protein?,carbs?,fat?}
ALTER TABLE recipes ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN legacy_import INTEGER NOT NULL DEFAULT 0;     -- 1 = importada do catálogo antigo (decisão D-1)
ALTER TABLE recipes ADD COLUMN metadata_reviewed_by TEXT;
ALTER TABLE recipes ADD COLUMN metadata_reviewed_at TEXT;
