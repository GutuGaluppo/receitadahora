# Receita da Hora Studio

Painel interno (desktop-first) que é a **linha de produção de conteúdo** do Receita da Hora:
receita → asset → revisão → aprovação → publicação. Especificação: [`../docs/IMPLEMENTATION_STUDIO.md`](../docs/IMPLEMENTATION_STUDIO.md).
É uma aplicação **separada** do app público (`../`), no mesmo repositório.

## Rodando

```bash
cd studio
npm install
npm run db:reset:local        # migrations + seed no D1 local (se o Worker estiver rodando, pare antes)
npm run dev                   # Worker (D1+R2 locais) em :8788  +  Vite em :5174
node scripts/seed-assets.mjs  # (opcional) imagens de teste pelo fluxo real, cobrindo todos os estados
npm run smoke                 # percorre o critério de sucesso do doc (§41) contra o Worker local
npm run check                 # typecheck + testes unitários
```

- `npm run dev` abre o front em http://localhost:5174 (proxy para o Worker). O Worker também serve o build do front em http://localhost:8788 (`npm run build` antes).
- D1 e R2 locais são **reais**, emulados pelo `wrangler` em `.wrangler/state` — não há mocks.

## Arquitetura

```text
Browser (React + Tailwind) ──/api/*──▶ Worker (Hono) ──▶ D1  (metadados)
                                                   └──▶ R2  (binários)
Receita da Hora ───────────/api/public/*──▶ Worker (só conteúdo publicado)
```

```text
studio/
  wrangler.jsonc            bindings: DB (D1), ASSETS_BUCKET (R2), STATIC (SPA) + env.production
  migrations/0001_init.sql  schema versionado
  seed/dev.sql              dados de desenvolvimento (Lote #001…)
  scripts/                  seed-assets.mjs · smoke.mjs · lib.mjs (gera PNG sem dependências)
  src/worker/
    index.ts  auth.ts  env.ts
    routes/   dashboard · ingredients · recipes · batches · review · public
    lib/      text (normalização) · matching (ingredientes) · duplicates (receitas) · status
              publish (validação) · assets (R2+D1) · prompt (Photography System) · repo · recipes
  src/client/               Dashboard · Receitas · Ingredientes · Lotes · Revisão
  tests/rules.test.ts       regras puras (matching, duplicidade, status, publicação, prompt)
```

### Dados (D1)
`recipes`, `ingredients`, `ingredient_aliases`, `recipe_ingredients`, `assets`, `batches` — IDs próprios
(`recipe_…`, `ingredient_…`, `asset_…`, `batch_…`; ordenáveis por tempo), slugs editáveis, soft delete
(`deleted_at`) em receitas, ingredientes e assets. Binários **nunca** vão para o D1: só `r2_key`, versão e status.

### Assets (R2)
```text
ingredients/tomate.png            ingredients/tomate-v2.png
recipes/{slug}/hero-v1.png        recipes/{slug}/hero-v2.png
```
Cada upload é uma **nova versão**; nada aprovado é sobrescrito. Só uma versão fica ativa
(`ingredients.asset_id`, `recipes.hero_asset_id`) e dá para voltar a uma anterior.
Se o D1 falhar depois do upload, o objeto é removido do R2 (sem órfãos).

### Regras que o sistema impõe
- **Reutilizar antes de criar**: nome normalizado → alias → slug → parecido. `Tomates`, `tomate fresco` → o mesmo `Tomate`.
  Nome parecido (ex.: `Pimentão` vs `Pimentão vermelho`) **pede decisão humana** (“Usar existente / Criar ingrediente”).
- **Gerar só o que falta**: ingredientes sem asset aprovado aparecem como pendentes; os existentes são reaproveitados.
- **Duplicidade de receitas**: nome + ingredientes + proporção aproximada + categoria + preparo (sem IA). Alta/média → “Ver existente / Continuar mesmo assim”.
- **Estados**: `draft → image_pending → review → approved → published` (e `rejected → draft`). Os três primeiros são
  calculados sozinhos; aprovar, rejeitar e publicar são ações humanas explícitas.
- **Publicar** exige dados válidos, imagem principal aprovada, **todos** os ingredientes com asset aprovado e receita aprovada;
  senão o Studio lista exatamente o que falta.
- Editar conteúdo ou trocar a imagem de uma receita aprovada/publicada a devolve para **revisão** (nada muda no público sem aprovação).
- Ingrediente em uso não pode ser excluído; o Studio mostra o impacto.

### API
Administrativa (`/api/*`, autenticada): `dashboard`, `ingredients` (+ `/match`, `/:id/asset[/approve|reject|activate/:id]`),
`recipes` (+ `/check`, `/:id/hero[/approve|reject|regenerate|activate/:id]`, `/:id/approve|reject|reopen|publish|unpublish`),
`batches` (+ `/:id/import`, `/:id/recipes`, `/:id/complete`), `review`, `assets/*`.

Pública, para o Receita da Hora (somente publicados, sem metadata interna, CORS aberto):
```text
GET /api/public/recipes
GET /api/public/recipes/:slug
GET /api/public/categories
GET /api/public/assets/*          (só arquivos aprovados de receitas publicadas)
```

## Autenticação
Nenhuma rota administrativa é pública. Em produção o Worker valida o JWT do **Cloudflare Access**
(`Cf-Access-Jwt-Assertion`: RS256 pelo JWKS do time, `aud`, `iss`, `exp`). Sem `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD`
configurados ele responde 503 (falha fechada). `ACCESS_BYPASS=true` só vale em desenvolvimento e é recusado em produção.

## Ambientes e deploy
`development` (padrão) usa D1/R2 **locais**. `--env production` usa outro banco e outro bucket, para o dev nunca escrever em produção.
Passos únicos (exigem a sua conta Cloudflare — não foram executados):

```bash
npx wrangler d1 create studio-db                    # copie o id para env.production.d1_databases[0].database_id
npx wrangler r2 bucket create receita-da-hora-assets
# Zero Trust → Access → criar aplicação para o domínio do Studio; preencher CF_ACCESS_TEAM_DOMAIN e CF_ACCESS_AUD em wrangler.jsonc
npm run db:migrate:production
npm run deploy:production
```
`npx wrangler deploy --dry-run --env production` valida o bundle sem publicar.

## Decisões e limites do MVP
- **Sem Cloudflare Images**: R2 basta no MVP; as chaves e a tabela `assets` já comportam derivados (`card`, `thumb`, WebP) depois.
- **Regenerar** não chama nenhum gerador: rejeita a versão atual e mostra o **prompt oficial** do
  [Recipe Photography System](../docs/RECIPE_PHOTOGRAPHY_SYSTEM_v0.1.md) (usando só os `visual_ingredients` da receita)
  para você gerar a imagem e enviá-la com “Substituir”. Nada é gerado nem publicado automaticamente.
- Layout das chaves do R2 segue o IMPLEMENTATION_STUDIO (`recipes/{slug}/hero-vN`); o Photography System sugere
  `recipes/{id}/master|hero-desktop|…`. Como a chave real fica no banco, trocar depois não quebra nada.
- Fora do escopo (conforme o doc): analytics, permissões por usuário, comentários, workflow configurável, IA autônoma, notificações.
