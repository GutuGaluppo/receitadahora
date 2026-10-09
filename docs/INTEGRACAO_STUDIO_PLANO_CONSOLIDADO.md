# Integração Studio → Receita da Hora — plano consolidado

**Substitui, como referência única de execução:** [INTEGRACAO_STUDIO_RECEITA_DA_HORA.md](./INTEGRACAO_STUDIO_RECEITA_DA_HORA.md) (visão), [INTEGRACAO_STUDIO_MELHORIAS.md](./INTEGRACAO_STUDIO_MELHORIAS.md) (revisão técnica) e [INTEGRACAO_STUDIO_PLANO_SEGURO.md](./INTEGRACAO_STUDIO_PLANO_SEGURO.md) (decisões e gates). Os três permanecem como histórico e evidência.
**Status:** proposta para aprovação antes de implementar
**Última atualização:** 8 de outubro de 2026

Onde este documento diverge do Plano Seguro, a divergência está marcada com **[ajuste]** e explicada na seção 14.

---

## 1. Objetivo

1. **Conteúdo:** uma receita criada, revisada e publicada no Studio aparece no app público como candidata válida ao recomendador, sem editar código nem fazer novo deploy do app. Despublicar a retira de forma confiável.
2. **Contas:** pessoas criam conta (e-mail/senha ou Google), confirmam o e-mail, recuperam a senha e reencontram perfil, salvos e feedbacks em outro dispositivo. Dados privados protegidos por RLS.

Os dois objetivos são independentes entre si, exceto em um ponto (a tabela de ids legados, §6.4). Eles seguem em trilhos paralelos (§11).

## 2. Princípios

1. Uma única fonte de verdade para conteúdo: Studio/D1/R2. Nunca uma cópia manual no Supabase.
2. Publicar é o contrato. Só `published` chega ao app.
3. Dados de usuário isolados por RLS; nenhum segredo com prefixo `NEXT_PUBLIC_`.
4. Preview e staging nunca tocam produção.
5. **Dado crítico de segurança alimentar não é inferido nem assumido:** ausência é bloqueio, não padrão.
6. Integração gradual e reversível; o fallback é contingência observável, não segunda fonte editorial.
7. Falhar de forma segura: contrato inválido ou Studio fora nunca renderiza conteúdo parcial nem reexibe conteúdo retirado.

## 3. Arquitetura e responsabilidades

```text
Cloudflare: Studio
  painel interno ─► Worker ─► D1 (receitas, ingredientes, estados)   studio.<dominio>  (Access)
                             R2 (imagens)
                      └─ /api/public/*  (somente publicado)           content-api.<dominio>
                      └─ webhook assinado ──────────────┐
                                                         ▼
Vercel: app Next.js (app.<dominio>)
  servidor: adapter + Zod + cache('catalog') ◄── content-api
  navegador: CatalogProvider (props do servidor); Supabase Auth + Postgres (só dados do próprio usuário)
                                   │ SMTP
                                   ▼
                                Resend (e-mails de Auth, via Supabase)
```

| Sistema | Responsável por | Não é responsável por |
|---|---|---|
| Studio + D1 | receita, ingredientes, aprovação, publicação, metadados de recomendação | contas públicas, favoritos, feedback |
| R2 | binários de imagens aprovadas | metadados, regras de acesso |
| Worker | API pública de leitura; API admin protegida; webhook de revalidação | autenticação de consumidores |
| Supabase Auth | identidade, sessão, e-mail/senha, OAuth | autorização do Studio |
| Supabase Postgres | perfil, salvos, feedback, eventos | cópia do catálogo |
| Resend | SMTP transacional de Auth | sessão, usuários |
| Vercel | executar o app Next.js | acesso direto a D1/R2 |

## 4. Estado atual do repositório (verificado)

**App público (`/`)**
- Next.js 16.4, React 19, TypeScript, `cacheComponents: true` e `partialPrefetching: true` (`next.config.ts`).
- Catálogo escrito à mão em `src/data/recipes.ts`, com ids legíveis (ex.: `pasta-cremosa-abobora`). `Home`, `Onboarding` (fixa esse id como herói, linha 21) e `SavedRecipes` importam `RECIPES`/`RECIPES_BY_ID` direto.
- `page.tsx` é um Server Component simples que renderiza `App` (`"use client"`).
- Persistência local-first em `localStorage` (`src/services/storage.ts`; `MAX_EVENTS = 500`; ids de feedback/evento gerados no cliente por `uid()`).
- O recomendador usa `ingredientsTags` **e** `ingredients[].item` nos hard stops (`recipeHasTerm`, `src/services/recommendation.ts`).
- `RecipeImage` usa `<img>` simples e, sem `imageUrl`, desenha uma ilustração a partir da paleta. Só uma receita tem foto hoje.
- `supabase/schema.sql` existe mas nunca foi aplicado; contém tabelas editoriais que contradizem a arquitetura.

**Studio (`/studio`)**
- Vite + Worker Hono; D1 e R2. Rotas públicas: `/api/public/recipes`, `/recipes/:slug`, `/categories`, `/assets/*`. A lista **não** traz ingredientes (`routes/public.ts:16-32`).
- `publishBlockers` exige dados básicos, imagem principal aprovada, **imagem aprovada de todos os ingredientes** e revisão aprovada (`lib/publish.ts`).
- Assets com chave versionada (`recipes/<slug>/hero-v<n>`) e `Cache-Control` imutável de 1 ano (`lib/assets.ts:29-39`).
- Access validado por JWT (`auth.ts`); `ACCESS_BYPASS` bloqueado em produção.
- `wrangler.jsonc`: D1 `studio-db` (dev e prod), bucket de produção `receita-da-hora-assets`; **não existe `env.staging`**; `run_worker_first: ["/api/*"]` com fallback SPA.

## 5. Problemas conhecidos que este plano resolve

| Problema | Onde | Resolução |
|---|---|---|
| Lista pública sem ingredientes inviabiliza o filtro de alergia sem N+1 | `public.ts` | catálogo v1 completo (§6.1) |
| Ids legados ≠ `recipe_…`; favoritos quebrariam | `recipes.ts` vs Studio | `legacy_ids` + tradução (§6.4) |
| `NEXT_PUBLIC_STUDIO_API_URL` é fixada no build | doc original §11.2 | `STUDIO_PUBLIC_API_URL` só no servidor (§8.2) |
| Nomes de D1/R2 do doc ≠ `wrangler.jsonc`; sem staging | doc original §6.1 | padronização e `env.staging` (§7.2) |
| "Atraso máximo de 1 min" incorreto | doc original §7.4 | invalidação ativa (§8.3) |
| Alérgenos tratados como campo comum | doc original §7.1 | regras de §6.2 |
| Host público serve SPA e rotas admin | `wrangler.jsonc`, `index.ts` | minimização do host (§7.1) |
| `middleware.ts` → `proxy.ts` | doc original §9.4 | §9.4 |
| Schema Supabase: sem `delete` de eventos, sem trigger de perfil, ids no servidor | `schema.sql` | §9.1 |
| Receitas importadas podem não ser publicáveis (imagens) | `publish.ts` vs `recipes.ts` | decisão D-1 (§13) |

## 6. Conteúdo: contrato e regras do Studio

### 6.1 Catálogo versionado e completo

```text
GET /api/public/v1/catalog  →  { schemaVersion: 1, generatedAt, recipes: StudioPublicRecipe[] }
```

- Cada receita traz tudo que o tipo `Recipe` do app precisa: dados editoriais, ingredientes, passos, metadados de recomendação, imagem, `publishedAt`, `legacyIds`.
- `ETag` e `Last-Modified`; o adapter usa requisição condicional.
- Mudanças aditivas ficam em `v1`; incompatíveis criam `v2`. O adapter recusa `schemaVersion` desconhecido.
- As rotas antigas permanecem por compatibilidade, mas o app só usa o catálogo v1.
- Se o catálogo crescer, paginar por cursor mantendo `generatedAt` como marca de consistência.

```ts
type StudioPublicRecipe = {
  id: string; slug: string; legacyIds: string[];
  title: string; description: string; imageUrl: string | null;
  prepTimeMinutes: number;               // prep_time + cook_time do Studio
  servings: number; cuisine: string; featured?: boolean;
  mealTypes: ("breakfast" | "lunch" | "snack" | "dinner")[];
  dietaryTags: ("vegetarian" | "vegan" | "lactose-free" | "gluten-free")[];
  ingredientsTags: string[];             // [0] = ingrediente principal; inclui alérgenos pt-BR
  allergens: string[];                   // sempre presente; "[]" = revisado, nenhum
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  traits: { comfort: number; lightness: number; protein: number; cost: number; novelty: number };
  weatherAffinity: { hot: number; mild: number; cold: number; rainy: number };
  paletteKey: string;                    // preset de src/data/palettes.ts
  ingredients: { item: string; quantity: number | null; unit: string; note?: string; imageUrl?: string | null }[];
  steps: { number: number; instruction: string }[];
  publishedAt: string;
};
```

### 6.2 Metadados e regras de publicação

Migration no Studio (`studio/migrations/0003_…`) com: `legacy_ids`, `meal_types`, `dietary_tags`, `allergens` (+ revisor e data), `ingredients_tags`, `cuisine`, `traits`, `weather_affinity`, `palette_key`, `nutrition`, `featured`.

- **Modelagem:** JSON validado por Zod para `traits`, `weather_affinity`, `nutrition` (lidos sempre juntos; catálogo pequeno; o filtro acontece no app). Vocabulário fechado em código para `meal_types` e `dietary_tags`.
- **Alérgenos:** `allergens = null` = não revisado e **bloqueia** a publicação; `[]` = revisado, nenhum declarado.
- **Origem:** `ingredients_tags` e alérgenos derivam dos ingredientes globais normalizados (com aliases) e são apenas **complementados** por revisão humana, nunca inferidos de texto livre. O 1º item de `ingredients_tags` é o ingrediente principal.
- **IA/Content Factory:** metadados sugeridos entram como `suggested` e não satisfazem `publishBlockers` até confirmação humana registrada (`studio/src/worker/lib/factory/normalize.ts` é o ponto de extensão).
- **Faixas:** `traits` e `weather_affinity` entre 0 e 100, com **rubrica de âncoras** exibida no formulário (ex.: `comfort` 80 = prato quente e denso; 20 = prato frio e leve).
- **Paleta:** chave de preset (`PALETTES`, 10 opções); o adapter expande para `RecipePalette`. Sem hex livres.
- **Mensagens de bloqueio específicas** (ex.: "Revise os alérgenos antes de publicar").
- **Quantidade:** `quantity: number | null` + `note`. Ampliar o tipo `Recipe` (`ingredients[].quantity: number | null`, `note?`) e renderizar "a gosto"; nunca usar `0`.
- **`active`/`createdAt`:** o adapter define `active = true` e `createdAt = publishedAt`.

### 6.3 Importação das receitas atuais (Marco 0)

1. Importar `src/data/recipes.ts` para o D1 (ponto de partida: `studio/seed/dev.sql`, `studio/scripts/seed-assets.mjs`).
2. Gravar o id atual em `legacy_ids`.
3. Cada receita importada passa pela mesma revisão de alérgenos (§6.2); não há atalho.
4. O herói do `Onboarding` deixa de depender de um id fixo: usa `featured` ou, se ausente, a primeira receita publicável.

### 6.4 Tabela de ids legados

- O catálogo expõe `legacyIds` durante a transição.
- Ao carregar o `localStorage` antigo, o app traduz ids (saved, feedback, eventos) para os novos antes de qualquer sincronização com o Supabase.
- Id que não resolve é descartado de forma documentada (registrado em log local, não em erro de UI).
- Esta é a única dependência entre os trilhos de Conteúdo e Contas.

## 7. Cloudflare

### 7.1 Host público minimizado

```text
studio.<dominio>       painel + APIs admin; Cloudflare Access obrigatório
content-api.<dominio>  somente /api/public/*; sem SPA, sem rotas admin
app.<dominio>          app Next.js (Vercel)
```

- No host `content-api`, qualquer caminho fora de `/api/public/*` responde 404 (checagem por hostname no início de `studio/src/worker/index.ts`). Alternativa: Worker separado só de leitura.
- `workers_dev: false` e `preview_urls: false` em staging e produção.
- Cache de borda para o catálogo respeitando `ETag`; regras de rate limiting/WAF no host público.
- CORS: o app consome no servidor, portanto o `origin: "*"` atual (`public.ts:12`) pode ser restringido. Imagens (`<img>`) não dependem de CORS.
- Assets imutáveis de 1 ano são corretos (chave versionada), mas **despublicar não invalida cópias em cache**. Se uma imagem precisar sumir, fazer purge explícito.

### 7.2 Ambientes físicos

```text
receita-da-hora-studio-staging    D1 staging
receita-da-hora-studio-prod       D1 produção
receita-da-hora-assets-staging    R2 staging
receita-da-hora-assets-prod       R2 produção
```

- Adicionar `env.staging` em `studio/wrangler.jsonc` com IDs, bucket, domínio Access próprios e `ACCESS_BYPASS=false`. Manter os placeholders `REPLACE_WITH_…` até a criação real.
- Scripts: `db:migrate:staging`, `deploy:staging`, `db:migrate:production`, `deploy:production`.
- Ao padronizar nomes, alterar também `database_name` e os scripts atuais que usam `studio-db`, para não criar recursos que o Worker não referencia.
- Migrations sempre versionadas; nenhum SQL manual em produção.

### 7.3 Access e segredos

- Access protege apenas `studio.<dominio>`. `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD` por ambiente. `ACCESS_BYPASS` nunca em produção.
- Segredos (`OPENAI_API_KEY`, `APP_REVALIDATE_SECRET`) apenas como Workers secrets (`wrangler secret put … --env <ambiente>`).

## 8. App Next.js

### 8.1 Fronteira de dados

`src/services/studio-content.ts` é o único lugar que conhece a API do Studio:
1. lê `STUDIO_PUBLIC_API_URL` (servidor);
2. busca o catálogo v1 com requisição condicional;
3. valida com Zod (schema compartilhado, §8.5);
4. converte o DTO em `Recipe`, resolve URLs de asset para absolutas e expande `paletteKey`;
5. expõe `getCatalog()` com `'use cache'`, `cacheLife(...)` e `cacheTag('catalog')` (confirmar a sintaxe em `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` antes de implementar);
6. emite erro observável se o contrato for inválido ou a API estiver fora.

`src/app/page.tsx` (servidor) chama `getCatalog()` e passa o resultado a `App`, que o entrega por um `CatalogProvider` (mesmo padrão de `AppProvider`/`WeatherProvider`). Os componentes usam `useCatalog()`. Nenhum componente importa `src/data/recipes.ts` nem faz `fetch` ao Worker.

`Home.tsx:131` e `SavedRecipes.tsx:33-34` passam a tolerar ids ausentes (§8.4).

### 8.2 Variáveis (somente servidor para o Studio)

Ver §12. `STUDIO_PUBLIC_API_URL` **sem** `NEXT_PUBLIC_`: variáveis com esse prefixo são fixadas no bundle em `next build` e não respondem a mudanças depois (`docs/01-app/02-guides/environment-variables.md`).

### 8.3 Invalidação ativa

O TTL é rede de segurança, não a garantia. Fluxo:

```text
publicar / despublicar / editar publicada
  → Worker envia POST assinado para app.<dominio>/api/revalidate
  → Route Handler valida HMAC-SHA256(timestamp + corpo) e janela de 5 min
  → revalidateTag("catalog", { expire: 0 })
  → próxima requisição busca o catálogo novo (bloqueante, sem servir antigo)
```

- `{ expire: 0 }` é deliberado: `profile="max"` serviria o conteúdo antigo enquanto revalida (`revalidateTag.md`), inadequado para despublicação por risco alimentar.
- **[ajuste] Sem armazenamento de nonce.** A revalidação é idempotente; um replay dentro da janela apenas repete a invalidação. HMAC + timestamp + log estruturado bastam e evitam um serviço de estado só para isso.
- TTL de alguns minutos como recuperação se o webhook falhar; alerta quando houver falha ou latência alta.
- **[ajuste] Sessões já abertas.** O app é client-first: quem está com a aba aberta mantém o catálogo antigo em memória e no cache do roteador. A despublicação **não é instantânea para sessões ativas**. Mitigação: ao voltar o foco para a aba (`visibilitychange`) após mais de poucos minutos, recarregar o catálogo (`router.refresh()`); documentar o limite na política de incidentes.

### 8.4 Despublicação e receitas salvas

Registros em `saved_recipes`, feedback e eventos não são apagados quando a receita sai do catálogo. A UX é decisão de produto (D-3, §13); até lá, o comportamento padrão é **ocultar do recomendador e mostrar o salvo como "indisponível"** em vez de sumir silenciosamente com o contador mudando.

### 8.5 Contrato testado nos dois lados

Os projetos têm `package.json` próprios (o `tsconfig.json` do app exclui `studio/`). Manter o schema Zod do DTO e uma fixture JSON em `contracts/` importados pelos dois lados, ou fixture versionada testada em `tests/` do app e em `studio/tests/`. Ambos usam Zod ^4.

### 8.6 Fallback: snapshot de contingência (com limites)

Um passo `prebuild` grava `src/data/catalog.snapshot.json` a partir do catálogo validado, com `generatedAt`. Usos: fixture determinística de testes e e2e e último recurso em falha do Studio. Substitui o `recipes.ts` escrito à mão após o Marco 0.

**[ajuste] Regras para o snapshot não reviver conteúdo retirado:**
1. **Idade máxima** (`SNAPSHOT_MAX_AGE_HOURS`): acima disso o app mostra estado degradado e não recomenda a partir do snapshot.
2. **Lista de bloqueio por id** (kill switch) mantida fora do snapshot e consultável pelo app (ex.: arquivo/variável servidor atualizável sem rebuild); o snapshot filtra por ela.
3. No fallback, só entram receitas com `allergens` revisado.
4. O uso do snapshot gera erro/alerta e aparece nas métricas.

"Último catálogo cacheado" por si só não é garantia entre instâncias e deploys; o snapshot de build é.

## 9. Supabase, Auth e e-mail

### 9.1 Schema privado (substitui `supabase/schema.sql` antes do 1º apply)

Migrations versionadas em `supabase/migrations/` com apenas `profiles`, `saved_recipes`, `recipe_feedback`, `recommendation_events`, índices, triggers, RLS e retenção.

| Ponto | Regra |
|---|---|
| Receitas | sem tabelas editoriais; `recipe_id text not null` sem FK, com `check (char_length(recipe_id) between 1 and 128)` |
| `profiles` | criado por trigger em `auth.users` ou `upsert` no primeiro login |
| Idempotência | `recipe_feedback` e `recommendation_events` aceitam `id` gerado no cliente (`uid()` do `storage.ts`); importação com `on conflict (id) do nothing`; `saved_recipes` com `unique (user_id, recipe_id)` |
| RLS | `auth.uid() = user_id` em tudo; eventos: select, insert e **delete** próprios; sem update |
| Volume | retenção para `recipe_shown` (ex.: 90 dias) ou agregação; o cliente corta em 500, o servidor não |
| `context_snapshot` | limite de tamanho (`pg_column_size`) |
| `onboarded` | fonte única no perfil remoto após login |
| Privilégios | nenhuma chave `service_role` no cliente; só em Route Handler servidor, para exclusão de conta |

### 9.2 Migração do `localStorage` no primeiro login

1. Ler e validar `receita-da-hora:v1` com o schema Zod existente; traduzir ids legados (§6.4).
2. Salvos: upsert por `(user_id, recipe_id)`; conflito mantém o `saved_at` mais antigo.
3. Feedback e eventos: `on conflict (id) do nothing`.
4. Perfil: se o servidor já tem `onboarded = true`, o servidor vence; senão sobe o local. Se ambos existem e divergem, perguntar ao usuário.
5. Gravar `migratedFor: userId` só após sucesso; **não apagar** o `localStorage` antes de uma sincronização bem-sucedida.
6. Uma chamada em lote por tabela; falha parcial não bloqueia o app.

### 9.3 Projetos e redirects

Projetos Supabase distintos para staging e produção.

| Projeto | Redirect URLs |
|---|---|
| produção | somente `https://app.<dominio>/**` |
| staging | `http://localhost:3000/**` e o padrão de previews do Vercel |

O wildcard `*.vercel.app` **nunca** no projeto de produção.

### 9.4 Integração no Next.js

- Cliente de navegador para as tabelas privadas; `@supabase/ssr` com cookies.
- **`proxy.ts`** (não `middleware.ts`), apenas para renovar a sessão; autorização fica perto dos dados (RLS) (`docs/01-app/01-getting-started/16-proxy.md`).
- Se algo ler a sessão no servidor com `cacheComponents`, `cookies()` deve ficar dentro de `<Suspense>` e a leitura em `'use cache: private'`, nunca em `'use cache'` comum (`docs/01-app/02-guides/authentication-with-cache-components.md`).
- Rotas: `src/app/auth/callback/route.ts` (troca do `code` por sessão e redirecionamento interno seguro), tela de redefinição de senha.

### 9.5 E-mail e senha, Resend, Google

- Habilitar Email + Password e confirmação de e-mail; definir política de senha; proteção contra senhas vazadas quando o plano permitir.
- **Resend como SMTP do Supabase** (não usar o SDK no app): domínio de envio dedicado (`email.<dominio>`) verificado, SPF, DKIM e **DMARC**; chave dedicada; `smtp.resend.com`, porta 465, usuário `resend`; remetente `Receita da Hora <…@email.<dominio>>`. A chave fica **no painel do Supabase**, não no Vercel.
- Templates em português para confirmação e redefinição; sem rastreamento de links nos e-mails de Auth.
- Ajustar os rate limits de e-mail do Supabase (o limite inicial com SMTP próprio é baixo) antes do lançamento.
- **CAPTCHA (Turnstile)** no cadastro e na recuperação de senha.
- Google OAuth (tipo Web): origens `http://localhost:3000` e `https://app.<dominio>`; redirect URI exato `https://<ref>.supabase.co/auth/v1/callback`; `signInWithOAuth` + `/auth/callback`. A vinculação por e-mail só é segura com e-mail verificado; manter a confirmação ativa.
- A resposta de recuperação de senha não revela se o e-mail existe.

### 9.6 Privacidade (LGPD)

- Eventos, cidade/país/timezone e preferências alimentares são dados pessoais, possivelmente sensíveis. Definir base legal e consentimento explícito para clima por localização.
- Interface de **exportação** e **exclusão** de conta (cascata por `auth.users` já existe).
- Política de privacidade visível antes do cadastro; retenção de eventos documentada.

## 10. Ambientes

| Ambiente | Studio (D1/R2) | Supabase | App | Finalidade |
|---|---|---|---|---|
| Local | emuladores Wrangler (`.wrangler/state`) | dev/local | `localhost:3000` | desenvolvimento |
| Staging | `*-staging` | projeto staging | Vercel Preview | integração |
| Produção | `*-prod` | projeto prod | `app.<dominio>` | usuários reais |

Vercel Preview aponta para Studio e Supabase de staging, nunca produção. Projeto Vercel com Root Directory `.`; `studio/` não é projeto Vercel. Configurar Ignored Build Step/`.vercelignore` para commits que só alterem `studio/` não dispararem deploy do app, e confirmar que `vitest.config.ts` e `eslint.config.mjs` da raiz ignoram `studio/` (o `tsconfig.json` já exclui). Variáveis alteradas só valem em novo deployment.

## 11. Execução em dois trilhos

```text
Trilho Conteúdo:  M0 ─► M1 ─► M2 ─► M3 ─► M4
Trilho Contas:    C1 ─► C2 ─► C3 ─► C4 ───────┐
                                               └─► C5 (merge do localStorage; precisa de M0 concluído)
Fechamento:       E (LGPD, observabilidade, produção, remoção do fallback manual)
```

**Trilho Conteúdo**
- **M0 — Fundação:** padronizar recursos e criar `env.staging` (§7.2); importar o catálogo atual com `legacy_ids` (§6.3).
- **M1 — Contrato editorial:** migration de metadados, bloqueios de publicação (§6.2), rubrica de `traits`.
- **M2 — Catálogo v1:** endpoint, schema compartilhado, fixture, host público minimizado (§6.1, §7.1).
- **M3 — App:** adapter, `CatalogProvider`, remoção dos imports estáticos, tolerância a ids ausentes.
- **M4 — Atualização confiável:** webhook, snapshot com limites, recarga ao voltar o foco.

**Trilho Contas**
- **C1:** Supabase staging + migrations privadas + RLS testada com dois usuários.
- **C2:** e-mail/senha, confirmação e reset (Resend SMTP, templates, DMARC).
- **C3:** Google OAuth e `/auth/callback`.
- **C4:** CAPTCHA e rate limits.
- **C5:** migração idempotente do `localStorage` com tradução de ids legados.

**E — Fechamento:** exportação/exclusão de conta, retenção de eventos, alertas e dashboards (erros de API, Auth e e-mail; disponibilidade do Worker; falha de deploy), rotação de segredos, produção, remoção do fallback manual após período de estabilidade.

## 12. Variáveis de ambiente

**App no Vercel**
```bash
# Somente servidor
STUDIO_PUBLIC_API_URL=https://content-api.<dominio>
STUDIO_REVALIDATE_SECRET=<segredo-HMAC>
SNAPSHOT_MAX_AGE_HOURS=<n>
# Publicáveis
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<chave>
NEXT_PUBLIC_SITE_URL=https://app.<dominio>
```
Por ambiente (Development / Preview / Production) apontando para os recursos correspondentes.

**Worker do Studio**
```text
ENVIRONMENT=staging|production
ACCESS_BYPASS=false
CF_ACCESS_TEAM_DOMAIN=<time>.cloudflareaccess.com
CF_ACCESS_AUD=<aud-do-studio>
APP_REVALIDATE_URL=https://app.<dominio>/api/revalidate
APP_REVALIDATE_SECRET=<mesmo segredo, como Workers secret>
```

**Não pertencem ao Vercel:** chave SMTP do Resend (painel do Supabase), `CF_ACCESS_*`, chaves de IA (Workers secrets), `SUPABASE_SERVICE_ROLE_KEY` (nenhum cliente; no servidor só para exclusão de conta, se for o caso).

## 13. Decisões pendentes (precisam de dono antes de codar)

| ID | Decisão | Recomendação |
|---|---|---|
| **D-1** | **Receita sem imagem pode ser publicada?** Hoje o Studio exige imagem principal e imagens de todos os ingredientes, mas só uma receita do catálogo atual tem foto e o `Recipe` do app não usa imagem de ingrediente | Manter imagem principal obrigatória para receitas **novas**. Para as importadas, ou produzir as imagens antes do corte, ou permitir publicar sem foto (o app já desenha a ilustração) sob flag explícita `legacy_import`. Retirar a exigência de imagem de ingrediente, a menos que a UI passe a usá-la. Sem essa decisão o catálogo encolhe no corte e o recomendador piora |
| D-2 | Taxonomia de alérgenos e dietas em português | Lista fechada, revisada por responsável editorial |
| D-3 | UX de receita salva despublicada | "Indisponível" visível (padrão do §8.4) |
| D-4 | Rubrica editorial de `traits` e afinidade climática | Âncoras 0–100 por atributo |
| D-5 | Domínios, DNS e contas (Cloudflare, Vercel, Supabase, Resend, Google Cloud) com responsáveis e acesso de recuperação | — |
| D-6 | Região, retenção e política de privacidade | Região conforme usuários; retenção de eventos definida |
| D-7 | Rollout | staging → beta controlada → produção |
| D-8 | Responsáveis por aprovação editorial, resposta a incidente e rotação de segredos | — |

## 14. Divergências em relação ao Plano Seguro e porquê

| Ponto | Plano Seguro | Este plano | Motivo |
|---|---|---|---|
| Snapshot | contingência sem limites | idade máxima, kill switch, só alérgenos revisados (§8.6) | um snapshot antigo reexibiria uma receita retirada por risco alimentar |
| Importação | publicar o que passar na validação | decisão explícita D-1 | a validação atual exige imagens que a maioria das receitas importadas não tem |
| Nonce no webhook | exigido | dispensado (§8.3) | revalidação idempotente; evita serviço de estado extra |
| Despublicação | "próxima visita busca o novo" | limite documentado para sessões abertas e recarga ao voltar o foco (§8.3) | o app é client-first |
| Ordem | backlog linear | dois trilhos com gates próprios (§11) | contas só dependem do trilho de conteúdo no merge (C5) |
| Host público | "somente `/api/public/v1/catalog`" | tudo em `/api/public/*` | rotas antigas e `/assets/*` continuam sob esse prefixo |
| Itens adicionais | — | CORS restrito, purge de assets, Ignored Build Step, sessão com Cache Components (§7.1, §9.4, §10) | presentes só no documento de melhorias |

## 15. Gates

Nenhum marco avança sem o gate do seu trilho. Gates de Conteúdo (A–C) e de Contas (D) são independentes.

### Gate A — Contrato editorial
- [ ] Todas as receitas expostas têm ingredientes, passos e metadados exigidos pelo `Recipe`.
- [ ] `allergens = null` bloqueia a publicação, com mensagem específica.
- [ ] Metadado sugerido por IA não satisfaz a publicação sem confirmação humana registrada.
- [ ] Para cada alérgeno da fixture, nenhuma receita que o contenha é recomendada.
- [ ] Schema Zod, `schemaVersion` e fixture testados no Worker e no app.
- [ ] Receita em `draft`, `review`, `approved` ou `rejected` e asset não aprovado não aparecem na API pública.

### Gate B — Catálogo no app
- [ ] Todo id legado de um `localStorage` antigo resolve para uma receita nova ou é descartado de forma documentada.
- [ ] O onboarding não depende de id estático.
- [ ] `quantity: null` ou "a gosto" nunca aparece como `0 g`.
- [ ] Receita salva despublicada não quebra `SavedRecipes` nem `Home`; comportamento definido (D-3).
- [ ] Nenhum componente importa o catálogo estático ou faz `fetch` ao Worker.
- [ ] Studio fora do ar: o app usa o último catálogo/snapshot válido dentro da idade máxima, registra o erro e, acima dela, entra em estado degradado.
- [ ] Snapshot respeita a lista de bloqueio.

### Gate C — Infraestrutura e atualização
- [ ] `content-api.*` retorna 404 para `/` e para qualquer `/api/*` fora de `/api/public/*`; não há `workers.dev` ou preview ativo fora do Access.
- [ ] Rotas administrativas do Studio retornam 401/403 sem Access.
- [ ] Staging e produção usam D1, R2, Supabase e domínios distintos; preview nunca usa produção.
- [ ] Publicar e despublicar disparam o webhook; assinatura inválida e timestamp antigo são rejeitados e registrados.
- [ ] Despublicação reflete no servidor em segundos com o webhook, ou dentro do TTL se ele falhar; o limite para sessões abertas está documentado.
- [ ] Nenhum segredo em `NEXT_PUBLIC_*`, Git, bundle ou logs.
- [ ] `npm run check` e `npm run build` passam no Vercel.

### Gate D — Contas e privacidade
- [ ] RLS testada com dois usuários, inclusive via API direta do Supabase.
- [ ] Repetir a migração do `localStorage` N vezes resulta no mesmo estado, sem duplicatas.
- [ ] Confirmação, reset e Google login funcionam; links retornam a URLs permitidas; o reset não revela se o e-mail existe.
- [ ] Domínio de envio com SPF, DKIM e DMARC válidos; CAPTCHA e rate limits ativos.
- [ ] Projeto Supabase de produção rejeita redirects `*.vercel.app`.
- [ ] O usuário apaga o próprio histórico de eventos; exclusão de conta remove os dados privados; exportação entrega os dados esperados.
- [ ] Logout limpa a sessão sem apagar dados remotos.

## 16. Rollback

| Falha | Resposta imediata | Recuperação |
|---|---|---|
| Catálogo incompatível | adapter recusa por Zod/`schemaVersion` e usa o último válido ou o snapshot (dentro dos limites) | corrigir contrato; publicar Worker compatível |
| Webhook falha | TTL recupera; alerta aberto | reenviar evento assinado ou invalidar a tag manualmente |
| Receita com metadado inseguro publicada | despublicar, acionar webhook, incluir o id na lista de bloqueio do snapshot | corrigir, revisar alérgenos e republicar; avaliar sessões abertas |
| Studio fora do ar | último catálogo/snapshot dentro da idade máxima | restaurar o Worker |
| Supabase/Auth indisponível | modo local preserva a navegação | não perder dados locais; retomar a sincronização |
| Deploy do app falha | manter o último deployment do Vercel | corrigir em staging e promover só build validado |

## 17. Definição de pronto

Uma pessoa da equipe cria, revisa (incluindo alérgenos) e publica uma receita no Studio e, sem editar código nem fazer deploy do app, ela aparece no Receita da Hora como candidata válida ao recomendador; despublicá-la a retira do servidor em segundos. Uma pessoa usuária cria conta, confirma o e-mail, recupera a senha, entra pelo Google e encontra perfil, salvos e feedbacks em outro dispositivo, com os dados privados protegidos por RLS e o painel administrativo protegido pelo Cloudflare Access. Os gates A a D estão fechados e as decisões D-1 a D-8 têm responsável e resposta registrada.
