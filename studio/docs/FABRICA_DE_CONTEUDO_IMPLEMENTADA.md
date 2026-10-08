# Content Factory — etapa implementada

Referência: `implementations/IMPLEMENTATION_FABRICA_DE_CONTEUDO.md`. Esta etapa entrega as fases 1 a 10 do spec com provider mock e imagens desligadas.

## Fluxo

```
Brief → job → provider → parse JSON → schema → normalização → duplicidade
      → resolução de ingredientes → assets ausentes → rascunhos num lote "Factory"
      → Review → Approve (humano) → Publish (fluxo existente)
```

Nada gerado por IA chega a `published` sem aprovação manual. A Factory não cria base paralela: tudo entra em `recipes`, `ingredients`, `assets` e `batches`.

## Banco (`migrations/0002_factory.sql`)

- `generation_templates`: templates versionados (recipe, recipe_image, ingredient_image, description, metadata).
- `generation_jobs`: status, template/versão, provider/modelo, `idempotency_key`, payloads, saída bruta, tipo de erro, tentativas, custo estimado/real.
- `generation_events`: linha do tempo legível de cada job.
- `generation_items`: cada receita gerada (created, duplicate, needs_decision, invalid, discarded, error).
- Colunas novas: `batches.source`; proveniência em `recipes` (`source_type`, `source_job_id`, `template_version`, `provider`, `model`, `generated_at`, `approved_by`, `approved_at`) e em `assets` (template, provider, modelo, prompt).

## Backend (`src/worker`)

- `lib/factory/config.ts`: feature flags (tudo desligado se ausente) e guardrails de custo (`checkBudget`).
- `lib/factory/normalize.ts`: extração de JSON, schema Zod, normalização (dificuldade, categoria, quantidades) e duplicidade por título.
- `lib/factory/providers.ts`: `RecipeGenerationProvider` (mock determinístico), `ImageGenerationProvider` (Disabled, Mock de dev e OpenAI protegido por flag e orçamento).
- `lib/factory/templates.ts`: templates padrão versionados e composição dos prompts de imagem (Recipe Photography System v0.1).
- `lib/factory/pipeline.ts`: execução dos jobs, persistência, resolução humana de itens, jobs de imagem, retry (máx. 3, manual) e cancelamento.
- `lib/factory/jobs.ts`, `state.ts`, `summary.ts`: jobs idempotentes, estados da Factory e resumo vivo.
- `routes/factory.ts`: `/api/factory/*` (config, overview, templates, jobs, itens, regeneração, prepare-assets).

## Interface (`src/client/pages/factory`)

Generate, Queue, History, Templates, Settings e detalhe do job (resumo, decisões, revisão rápida, eventos e auditoria). Bloco Factory no Dashboard, badge Factory em Lotes e card "Origem" na receita.

## Configuração

| Variável | Valor inicial |
| --- | --- |
| `CONTENT_GENERATION_ENABLED` | `true` |
| `IMAGE_GENERATION_ENABLED` | `false` |
| `AUTO_BATCH_GENERATION_ENABLED` | `false` |
| `DAILY_GENERATION_LIMIT` / `MONTHLY_GENERATION_BUDGET` | `0` |
| `RECIPE_PROVIDER` / `IMAGE_PROVIDER` | `mock` / `disabled` |

`OPENAI_API_KEY` só como secret do Worker.

## Validação

- `npm run check`: typecheck e 62 testes (43 da Factory).
- `npm run smoke:factory`: critério de sucesso do spec, em banco recém-resetado.
- Verificado manualmente: flag de texto desligada devolve 403; provider pago com limite 0 é bloqueado sem chamada externa; fluxo de imagem com provider mock; UI de Generate e detalhe do job.

## Limites conhecidos

- Só existe provider mock para texto. `OpenAIImageProvider` nunca foi chamado contra a API real.
- Sem estado `archived` de asset; versões antigas ficam preservadas e só uma é ativa.
- Com imagens desligadas, imagens são enviadas manualmente; a receita fica em "Imagem pendente" até lá.
- Sem geração agendada ou diária (por decisão do spec).
- Em produção, aplicar a migration: `npm run db:migrate:production`.
