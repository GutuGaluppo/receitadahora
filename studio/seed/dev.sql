-- Seed de DESENVOLVIMENTO. Não rodar em produção.

INSERT INTO batches (id, number, status, created_at) VALUES ('batch_seed_001', 1, 'open', '2026-10-07T09:00:00.000Z');

INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_abacate', 'Abacate', 'abacate', 'abacate', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_ovo', 'Ovo', 'ovo', 'ovo', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_ovo_1', 'ingredient_seed_ovo', 'ovo caipira', 'ovo caipira');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_pao', 'Pão', 'pao', 'pao', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_pao_0', 'ingredient_seed_pao', 'pão integral', 'pao integral');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_limao', 'Limão', 'limao', 'limao', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_limao_1', 'ingredient_seed_limao', 'limao siciliano', 'limao siciliano');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_pimenta', 'Pimenta', 'pimenta', 'pimenta', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_pimenta_0', 'ingredient_seed_pimenta', 'pimenta do reino', 'pimenta reino');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_pimenta_1', 'ingredient_seed_pimenta', 'pimenta calabresa', 'pimenta calabresa');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_massa', 'Massa', 'massa', 'massa', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_massa_0', 'ingredient_seed_massa', 'macarrão', 'macarrao');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_massa_1', 'ingredient_seed_massa', 'penne', 'penne');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_abobora', 'Abóbora', 'abobora', 'abobora', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_abobora_0', 'ingredient_seed_abobora', 'abóbora cabotiá', 'abobora cabotia');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_pimentao', 'Pimentão vermelho', 'pimentao-vermelho', 'pimentao vermelho', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_alho', 'Alho', 'alho', 'alho', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_alho_0', 'ingredient_seed_alho', 'dente de alho', 'dente alho');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_grao-de-bico', 'Grão-de-bico', 'grao-de-bico', 'grao bico', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_pepino', 'Pepino', 'pepino', 'pepino', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_tahine', 'Tahine', 'tahine', 'tahine', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_tahine_0', 'ingredient_seed_tahine', 'tahini', 'tahini');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_sal', 'Sal', 'sal', 'sal', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_aveia', 'Aveia', 'aveia', 'aveia', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_aveia_0', 'ingredient_seed_aveia', 'aveia em flocos', 'aveia floco');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_leite', 'Leite', 'leite', 'leite', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES ('ingredient_seed_canela', 'Canela', 'canela', 'canela', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES ('alias_seed_canela_0', 'ingredient_seed_canela', 'canela em pó', 'canela po');

INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at) VALUES ('recipe_seed_1', 'Torrada de Abacate com Ovo', 'torrada-de-abacate-com-ovo', 'Cremosa, crocante e com ovo mole por cima.', 'Café da manhã', 5, 5, 1, 'easy', '["Toste o pão até dourar.", "Amasse o abacate com limão e sal.", "Cozinhe o ovo por 6 minutos e descasque.", "Monte a torrada e finalize com pimenta."]', '[]', '["abacate", "pão", "ovo", "limão", "pimenta"]', 'image_pending', 'batch_seed_001', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_0', 'recipe_seed_1', 'ingredient_seed_abacate', 1, 'un', 'abacate', 0);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_1', 'recipe_seed_1', 'ingredient_seed_ovo', 1, 'un', 'ovo', 1);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_2', 'recipe_seed_1', 'ingredient_seed_pao', 2, 'fatias', 'pao', 2);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_3', 'recipe_seed_1', 'ingredient_seed_limao', 0.5, 'un', 'limao', 3);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_4', 'recipe_seed_1', 'ingredient_seed_pimenta', NULL, 'a gosto', 'pimenta', 4);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_1_5', 'recipe_seed_1', 'ingredient_seed_sal', NULL, 'a gosto', 'sal', 5);

INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at) VALUES ('recipe_seed_2', 'Massa Cremosa de Abóbora', 'massa-cremosa-de-abobora', 'Quente, cremosa e reconfortante para uma noite fria.', 'Massas', 10, 20, 2, 'easy', '["Asse a abóbora e o pimentão até ficarem macios.", "Bata com o alho e um fio de azeite até formar um molho cremoso.", "Cozinhe a massa e misture ao molho."]', '[]', '["roasted pumpkin", "red bell pepper", "parmesan", "black pepper"]', 'image_pending', 'batch_seed_001', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_2_0', 'recipe_seed_2', 'ingredient_seed_massa', 250, 'g', 'massa', 0);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_2_1', 'recipe_seed_2', 'ingredient_seed_abobora', 300, 'g', 'abobora', 1);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_2_2', 'recipe_seed_2', 'ingredient_seed_pimentao', 1, 'un', 'pimentao', 2);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_2_3', 'recipe_seed_2', 'ingredient_seed_alho', 1, 'dente', 'alho', 3);

INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at) VALUES ('recipe_seed_3', 'Salada de Grão-de-Bico com Tahine', 'salada-de-grao-de-bico-com-tahine', 'Fresca, cítrica e saciante.', 'Saladas', 15, 0, 2, 'easy', '["Escorra o grão-de-bico.", "Corte o pepino em cubos.", "Misture tudo com tahine e limão."]', '[]', '["chickpeas", "cucumber", "tahini", "lemon"]', 'image_pending', 'batch_seed_001', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_3_0', 'recipe_seed_3', 'ingredient_seed_grao-de-bico', 1, 'xícara', 'grao-de-bico', 0);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_3_1', 'recipe_seed_3', 'ingredient_seed_pepino', 1, 'un', 'pepino', 1);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_3_2', 'recipe_seed_3', 'ingredient_seed_tahine', 2, 'colheres de sopa', 'tahine', 2);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_3_3', 'recipe_seed_3', 'ingredient_seed_limao', 1, 'un', 'limao', 3);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_3_4', 'recipe_seed_3', 'ingredient_seed_sal', NULL, 'a gosto', 'sal', 4);

INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at) VALUES ('recipe_seed_4', 'Omelete Simples', 'omelete-simples', 'Três ovos, uma frigideira e dois minutos.', 'Café da manhã', 2, 5, 1, 'easy', '["Bata os ovos com sal.", "Frite em fogo médio e dobre ao meio."]', '[]', '["eggs"]', 'image_pending', 'batch_seed_001', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_4_0', 'recipe_seed_4', 'ingredient_seed_ovo', 3, 'un', 'ovo', 0);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_4_1', 'recipe_seed_4', 'ingredient_seed_sal', NULL, 'a gosto', 'sal', 1);

INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at) VALUES ('recipe_seed_5', 'Mingau de Aveia com Canela', 'mingau-de-aveia-com-canela', 'Quentinho e simples.', 'Café da manhã', 3, 7, 1, 'easy', '["Leve a aveia e o leite ao fogo baixo.", "Mexa até engrossar e finalize com canela."]', '[]', '["oats", "milk", "cinnamon"]', 'image_pending', 'batch_seed_001', '2026-10-07T10:00:00.000Z', '2026-10-07T10:00:00.000Z');
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_5_0', 'recipe_seed_5', 'ingredient_seed_aveia', 4, 'colheres de sopa', 'aveia', 0);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_5_1', 'recipe_seed_5', 'ingredient_seed_leite', 250, 'ml', 'leite', 1);
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, raw_name, sort_order) VALUES ('ri_seed_5_2', 'recipe_seed_5', 'ingredient_seed_canela', 1, 'colher de chá', 'canela', 2);

