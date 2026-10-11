# Integração Studio ↔ app público — avaliação e melhorias

**Documento avaliado:** [INTEGRACAO_STUDIO_RECEITA_DA_HORA.md](./INTEGRACAO_STUDIO_RECEITA_DA_HORA.md)
**Status:** revisão técnica com propostas de alteração (o documento original não foi modificado)
**Público:** engenharia e produto
**Data:** 8 de outubro de 2026

Cada achado foi conferido contra o código do repositório ou contra a documentação do Next.js instalada em `node_modules/next/dist/docs/`. As evidências aparecem como `arquivo:linha`.

---

## 1. Veredito

A decisão central está **correta e deve ser mantida**:

- Studio/D1/R2 é a única fonte do conteúdo editorial; o Supabase guarda só dados pessoais, referenciando receitas por `recipe_id` (texto).
- Publicação explícita como contrato; API pública separada da administrativa.
- RLS por `auth.uid()`; segredos fora do navegador; staging separado de produção.
- Resend via SMTP do Supabase (sem SDK no app).
- Fallback temporário e migração gradual.

O plano, porém, **não está pronto para execução**. Há comandos que criam recursos com nomes diferentes dos que o `wrangler.jsonc` espera, uma variável de ambiente que contradiz a própria meta ("sem novo deploy"), uma promessa de cache que não se sustenta, um contrato de API que não permite aplicar as regras de segurança do recomendador, e nenhuma etapa que preserve os favoritos já existentes.

### Resumo dos achados

| # | Achado | Severidade | Seção |
|---|---|---|---|
| 1 | Lista pública sem ingredientes impede o hard stop de alergia sem N+1 | **Bloqueante** | 2.1 |
| 2 | IDs do catálogo atual ≠ IDs do Studio; favoritos e feedback existentes quebram | **Bloqueante** | 2.2 |
| 3 | `NEXT_PUBLIC_STUDIO_API_URL` é fixada no build, contradiz o objetivo e o §8.1 | **Alto** | 2.3 |
| 4 | Nomes de D1/R2 do doc divergem do `wrangler.jsonc`; não existe ambiente de staging | **Alto** | 2.4 |
| 5 | "Atraso máximo de 1 minuto" é incorreto; pode passar de 2 minutos | **Alto** | 2.5 |
| 6 | Metadados de alérgenos/dietas são críticos de segurança e o doc os trata como campos editoriais comuns | **Alto** | 3.2 |
| 7 | O Worker público também serve o SPA e as rotas admin no host `content-api` | **Alto** | 5.1 |
| 8 | Wildcard de redirect de previews do Vercel no Supabase de produção | **Alto** | 6.4 |
| 9 | Schema Supabase: eventos não apagáveis, sem criação de `profiles`, merge não idempotente | **Médio** | 6.1–6.3 |
| 10 | `middleware.ts` virou `proxy.ts` no Next 16 | **Médio** | 2.6 |
| 11 | Mapeamentos indefinidos (`cook_time`, `quantity` nulo, paleta) | **Médio** | 3.3 |
| 12 | Despublicar uma receita salva por alguém: comportamento não definido | **Médio** | 3.4 |
| 13 | LGPD e anti-abuso ausentes | **Médio** | 6.5–6.6 |
| 14 | Trilhos de conteúdo e de contas acoplados sem necessidade | **Baixo** | 7 |

---

## 2. Erros e inconsistências verificados

### 2.1 A lista pública não serve ao recomendador

O doc (§8.1) prevê buscar a lista e "detalhes quando necessário". Mas `GET /api/public/recipes` não devolve ingredientes nem passos (`studio/src/worker/routes/public.ts:16-32`; só o detalhe por slug os traz, linhas 40-65).

O hard stop de alergia e de ingredientes excluídos depende dos ingredientes: `recipeHasTerm` varre `ingredientsTags` **e** `recipe.ingredients.map(i => i.item)` (`src/services/recommendation.ts`, função `recipeHasTerm`). Com a lista atual, ou o app faz uma chamada por receita (N+1 a cada revalidação), ou filtra com informação incompleta. Essa segunda opção é uma regressão de segurança.

**Mudança:** criar um endpoint de catálogo completo (ver 3.1), com ingredientes e passos incluídos, e usá-lo como única chamada do adapter.

### 2.2 IDs "estáveis" que hoje não são estáveis

O §14 mitiga o risco "IDs mudam" com "adotar o `recipes.id` estável do Studio". Só que o catálogo do app usa ids legíveis escritos à mão (`pasta-cremosa-abobora`, usado em `src/components/Onboarding.tsx:21` e como chave de imagem em `src/data/recipes.ts`), enquanto o Studio gera `recipe_…`. Qualquer favorito, feedback ou evento já gravado em `localStorage` (`src/services/storage.ts`) passa a apontar para ids inexistentes.

O doc também não prevê **importar as receitas atuais para o Studio**. Sem isso o primeiro deploy integrado teria um catálogo vazio ou diferente do atual.

**Mudança (Marco 0):**
1. Importar as receitas de `src/data/recipes.ts` para o D1 (há `studio/scripts/seed-assets.mjs` e `seed/dev.sql` como ponto de partida).
2. Guardar o id legado em cada receita (`legacy_ids` JSON) e expô-lo no DTO. O adapter traduz ids legados ao carregar o `localStorage`, uma única vez, antes do merge para o Supabase.
3. O `Onboarding` fixa `pasta-cremosa-abobora` como herói; trocar por uma regra (campo `featured` ou primeira receita publicada) ou manter esse id como `legacy_id` obrigatório.

### 2.3 `NEXT_PUBLIC_STUDIO_API_URL` é congelada no build

O §8.1 define `STUDIO_PUBLIC_API_URL` lida no servidor. O §11.2 usa `NEXT_PUBLIC_STUDIO_API_URL`. São incompatíveis: variáveis `NEXT_PUBLIC_` são substituídas no bundle em `next build` e "o app deixa de responder a mudanças dessas variáveis" depois de construído (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, seção sobre bundling). Trocar a URL do Studio exigiria novo deploy, e o catálogo será lido no servidor de qualquer forma.

**Mudança:** usar `STUDIO_PUBLIC_API_URL` **sem prefixo**, apenas no servidor. Manter `NEXT_PUBLIC_` só para URL e chave publicável do Supabase e para `NEXT_PUBLIC_SITE_URL`. Se o catálogo nunca é buscado no navegador, o CORS `*` do Worker também deixa de ser necessário para o app (ver 5.3).

### 2.4 Nomes de recursos e ausência de staging

| Doc §6.1 manda criar | `studio/wrangler.jsonc` / `package.json` usa |
|---|---|
| D1 `receita-da-hora-studio-prod` | `database_name: "studio-db"` (dev e prod; `db:migrate:production` aplica em `studio-db --env production`) |
| bucket `receita-da-hora-assets-prod` | `bucket_name: "receita-da-hora-assets"` em `env.production` (`wrangler.jsonc:41`) |
| ambientes de staging (§5.2) | não existe `env.staging`; nem scripts de migração/deploy de staging |

Seguir o doc ao pé da letra criaria recursos que o Worker não referencia, ou sobrescreveria a configuração sem querer. A tabela de ambientes do §5.2 hoje é aspiracional.

**Mudança:** decidir um padrão e alinhar tudo. Recomendação: `receita-da-hora-studio-{staging,prod}` e `receita-da-hora-assets-{staging,prod}`; adicionar `env.staging` ao `wrangler.jsonc` (com `ACCESS_BYPASS="false"` e seus próprios `CF_ACCESS_*`) e os scripts `db:migrate:staging`, `deploy:staging`. Nenhum `database_id` real deve ser commitado sem revisão; o placeholder `REPLACE_WITH_PRODUCTION_D1_ID` já protege contra deploy acidental e deve ganhar um irmão para staging.

### 2.5 O cache não entrega "até um minuto"

O §7.4 afirma que `max-age=60` na API mais revalidação de 60 s no Next dão atraso máximo de um minuto. Na prática:

- O navegador/CDN guarda a resposta da API por até 60 s antes de consultar a origem.
- No Next com Cache Components (já ligado em `next.config.ts`), o `cacheLife` usa semântica stale-while-revalidate: a primeira requisição depois do `revalidate` ainda recebe o conteúdo antigo enquanto a nova versão é buscada; e o cliente pode reutilizar o cache do roteador por `stale` (padrão de 5 min no perfil `default`, `cacheLife.md`).
- Os dois atrasos somam. O pior caso é maior que 2 minutos, e uma despublicação (que pode ser urgente, p. ex. erro de alérgeno) fica visível por esse tempo.

**Mudança:** tratar a revalidação por webhook como parte do Marco B, não do D (ver 4.2). Manter o TTL só como rede de segurança.

### 2.6 `middleware.ts` → `proxy.ts`

O §9.4 manda criar `middleware.ts`. No Next 16 a convenção se chama **Proxy** (`proxy.ts`, função `proxy`); a documentação instalada diz explicitamente que "Middleware is now called Proxy" e que ele não deve ser usado como solução completa de sessão/autorização (`01-app/01-getting-started/16-proxy.md`). Use-o apenas para renovar o cookie de sessão e faça a verificação de autorização perto do acesso aos dados (RLS já cumpre isso no Supabase).

---

## 3. Melhorias no contrato de conteúdo

### 3.1 Catálogo versionado e completo

Sugestão de rota nova, mantendo as atuais para compatibilidade:

```text
GET /api/public/v1/catalog   → { schemaVersion: 1, generatedAt, recipes: StudioPublicRecipe[] }
```

Justificativa:
- Uma chamada resolve o problema 2.1 e evita waterfalls.
- `schemaVersion` permite ao adapter recusar um contrato desconhecido em vez de interpretá-lo mal; mudanças aditivas ficam em `v1`, mudanças incompatíveis viram `v2` sem quebrar um app já em produção (resposta à pergunta 2 do doc).
- `ETag` e `Last-Modified` (resposta à pergunta 8) permitem `If-None-Match` do adapter: 304 barato em vez de reenviar o catálogo inteiro.
- Para dezenas ou poucas centenas de receitas o payload é pequeno; se crescer, paginar por cursor mantendo `generatedAt` como marca de consistência.

### 3.2 Alérgenos e dietas são dados críticos de segurança

`allergies`, `excludedIngredients` e `dietaryPreferences` são hard stops (`isValidRecipe`, `recommendation.ts`). Um metadado errado ou ausente em `ingredients_tags`/`dietary_tags` recomenda um prato inseguro para alguém. O doc os lista ao lado de `palette` como "campos de metadados". Proposta:

1. **"Não declarado" ≠ "nenhum"**. `allergens: string[] | null` (ou campo `allergens_reviewed_at`): `null` bloqueia a publicação; `[]` é uma declaração explícita revisada por pessoa.
2. **Ingredientes principais e alérgenos derivados de forma determinística** dos ingredientes (tabela de alérgenos por ingrediente global, já que o Studio tem `ingredients` normalizados e aliases), com **revisão humana** para complementar. `ingredientsTags[0]` precisa ser o ingrediente principal (regra do tipo `Recipe`, `src/types/index.ts`) e o vocabulário é pt-BR; isso deve estar no contrato, não implícito.
3. **Content Factory:** o pipeline de geração (`studio/src/worker/lib/factory/normalize.ts`) hoje valida só campos editoriais. Se o provedor de IA passar a sugerir metadados, eles entram marcados como `suggested` e **não satisfazem** `publishBlockers` até uma pessoa confirmar. Nunca publicar alérgeno vindo de IA sem confirmação.
4. Teste automatizado: para cada receita da fixture, `isValidRecipe` com cada alérgeno comum deve excluir exatamente as receitas esperadas.

### 3.3 Reduzir o trabalho editorial e fechar os mapeamentos

- **Paleta como nome de preset.** O app já tem 10 paletas aprovadas (`src/data/palettes.ts`, `PALETTES`), descritas como identidade visual fechada ("o layout nunca muda"). Pedir cinco hex livres por receita (§7.1) convida a incoerência visual e a texto ilegível. Guardar `palette: "warm" | "fresh" | …` no D1 e expandir para `RecipePalette` no adapter. O DTO, se for útil a outros consumidores, pode expor as duas coisas.
- **Rubrica para `traits` e `weather_affinity`.** São números 0–100 que dirigem o ranking. Sem âncoras ("comfort 80 = prato quente e denso; 20 = salada fria"), editores e IA vão divergir e o ranking deriva. Documentar a rubrica na própria tela do Studio.
- **Tempo:** o Studio tem `prep_time` e `cook_time` (`migrations/0001_init.sql`); o app tem `prepTimeMinutes` único e `PREP_TIME_WEIGHTS` pesa o tempo total. Definir `prepTimeMinutes = prep_time + cook_time`; é também o que `publishBlockers` já valida (`prep_time + cook_time <= 0`).
- **Quantidade ausente (pergunta 9):** `Recipe.ingredients[].quantity` é `number` e o Studio devolve `number | null` mais `note`. Opções: ampliar o tipo para `quantity: number | null` + `note?: string` e ajustar a renderização ("a gosto"), ou normalizar no adapter para um texto. Recomendado: ampliar o tipo; mentir com `0` produz "0 g de sal" na tela.
- **`active`:** o tipo `Recipe` tem `active` e `createdAt`; o DTO do doc não. Definir `active = true` para tudo que vem publicado e `createdAt = publishedAt` no adapter.

### 3.4 Despublicação e receitas salvas

Ao despublicar, o id some do catálogo. Hoje `SavedRecipes` descarta silenciosamente ids que não encontra (`src/components/SavedRecipes.tsx:33-34`: `recipe ? [recipe] : []`), e o contador "Receitas salvas (n)" muda sem explicação. O doc não define o comportamento desejado. Propostas:

- Manter o registro em `saved_recipes` (não é perda de dados) e mostrar um estado "indisponível" ou ocultar, mas **decidido por produto**, não por acidente.
- Revisar `Home.tsx:131` (`RECIPES_BY_ID.get(id)`), que deve tolerar id ausente.
- Para o recomendador, receita ausente não existe; eventos e feedback antigos continuam válidos como histórico.

---

## 4. Cache, integração no Next.js e resiliência

### 4.1 Onde buscar os dados

O app é uma página estática que monta um componente cliente (`src/app/page.tsx` → `App`, `"use client"`). `Home`, `Onboarding` e `SavedRecipes` importam `RECIPES`/`RECIPES_BY_ID` direto. Com `cacheComponents: true`, a forma natural é:

1. `studio-content.ts` expõe `getCatalog()` com `'use cache'`, `cacheLife(...)` e `cacheTag('catalog')`.
2. `src/app/page.tsx` (Server Component) chama `getCatalog()` e passa o resultado como prop para `App`, que o entrega por um `CatalogProvider` (padrão já usado em `AppProvider`/`WeatherProvider`).
3. Os componentes consomem `useCatalog()`; nenhum conhece URL ou JSON remoto.

Observação: o `cacheLife` e as tags devem ficar na própria função cacheada, como orienta `cacheLife.md`. Confirmar a sintaxe exata na documentação instalada antes de implementar.

### 4.2 Revalidação por webhook no Marco B

O Studio é o único escritor do conteúdo; saber quando algo mudou é trivial. Proposta:

- Ao publicar, despublicar ou editar uma receita publicada, o Worker faz `POST` assinado para `/api/revalidate` (Route Handler) no app.
- Assinatura HMAC-SHA256 sobre `timestamp + corpo`, janela de 5 min e rejeição de timestamps antigos (anti-replay); segredo compartilhado em Workers secrets e em variável **sem** `NEXT_PUBLIC_` no Vercel; log de cada chamada.
- O handler chama `revalidateTag('catalog', { expire: 0 })`. Detalhe importante, conforme `revalidateTag.md`: com `profile="max"` (o valor recomendado de forma geral) o primeiro acesso após a revalidação ainda recebe o conteúdo antigo enquanto o novo é buscado; `{ expire: 0 }` nunca serve conteúdo antigo e força busca bloqueante, que é o que se quer para despublicar com urgência. Chamar sem segundo argumento tem o mesmo efeito, mas está descontinuado.
- O TTL (`cacheLife` com `revalidate` de alguns minutos) permanece como rede de segurança caso o webhook falhe. Sem o webhook, a garantia de "publicou, apareceu" não existe (ver 2.5).

### 4.3 Fallback gerado, não escrito à mão

O doc mantém `src/data/recipes.ts` como fallback temporário. Isso cria **duas fontes de verdade**: a lista editada no Studio e a lista antiga, que divergem a cada receita nova.

Alternativa: um script `prebuild` busca o catálogo do Studio de **staging/produção** e grava `src/data/catalog.snapshot.json`. Ele serve (a) de último recurso quando o Studio está fora, (b) de fixture determinística para testes unitários e e2e (`e2e/journey.spec.ts`, `tests/recommendation.test.ts`), e (c) deixa claro quando está desatualizado (`generatedAt`). O arquivo escrito à mão é removido depois da importação do Marco 0.

Duas ressalvas operacionais:
- "Usar o último catálogo cacheado" (§8.3) não é garantia entre instâncias ou deploys; o snapshot de build é.
- Falha de contrato (Zod) deve registrar erro e cair no último bom, nunca renderizar parcialmente.

### 4.4 Teste de contrato

Os dois projetos têm `package.json` próprios (o `tsconfig.json` do app exclui `studio`), então não há tipo compartilhado automático. Para impedir deriva, escolher uma opção:

- pasta `contracts/` com o schema Zod do DTO e uma fixture JSON, importada pelos dois lados (o Studio também usa Zod ^4.6.5); ou
- fixture versionada gerada pelo Studio e testada no app (`tests/studio-contract.test.ts`) e no Worker (`studio/tests/rules.test.ts`).

---

## 5. Cloudflare e segurança

### 5.1 O host público não deve servir o painel

`wrangler.jsonc` define `assets.run_worker_first: ["/api/*"]` e `not_found_handling: "single-page-application"`. Se `content-api.seudominio.com` apontar para o **mesmo Worker** (§5.1 do doc), ele também entrega o SPA do Studio e roteia `/api/*` administrativas. As rotas admin continuam protegidas pelo JWT do Access (`studio/src/worker/auth.ts` valida assinatura, `aud`, `iss` e `exp`), então não é um buraco aberto, mas é superfície desnecessária e defesa em camada única.

**Mudanças:**
- No host público, responder 404 para qualquer caminho fora de `/api/public/*` (checagem por hostname no início de `studio/src/worker/index.ts`), **ou** separar um Worker só de leitura pública.
- Definir `workers_dev: false` e `preview_urls: false` nos ambientes de produção/staging para que não exista URL alternativa fora do Access.
- Documentar como teste de aceite: `content-api.*/` e `content-api.*/api/recipes` retornam 404/401.

### 5.2 Proteger o D1 do tráfego público

A API pública consulta o D1 a cada requisição. Com o catálogo servido ao app apenas pelo servidor e cacheado, o volume é baixo, mas o endpoint é público. Recomendado: cache de borda do Cloudflare (Cache API ou regra de cache) para `/api/public/v1/catalog` respeitando `ETag`, e regra de rate limiting/WAF para o host `content-api`.

### 5.3 CORS e assets

- `cors({ origin: "*" })` (`public.ts:12`) é aceitável para leitura pública, mas se só o servidor Next consome o catálogo, restringir o CORS reduz o risco de consumo indevido pelo navegador de terceiros. Os assets de imagem precisam continuar acessíveis (`<img>` não usa CORS).
- Os assets são imutáveis por 1 ano e a chave inclui a versão (`hero-v{n}`, `studio/src/worker/lib/assets.ts:29-32`), o que é correto. Porém, despublicar não invalida cópias já guardadas em navegadores e bordas. Documentar isso; se uma imagem precisar sumir de verdade, é preciso purge explícito.
- `RecipeImage` usa `<img>` simples (`src/components/RecipeImage.tsx`), então `images.remotePatterns` do `next/image` não é necessário. Se houver CSP, liberar o host de assets em `img-src`.

---

## 6. Supabase, Auth e e-mail

### 6.1 Ajustes ao `supabase/schema.sql`

Além de remover `recipes`, `recipe_ingredients`, `recipe_steps` e todas as chaves estrangeiras para `recipes` (já previsto no doc §9.2), o schema atual precisa de:

| Ponto | Situação atual (`supabase/schema.sql`) | Mudança |
|---|---|---|
| Criação de `profiles` | nada cria a linha no cadastro | trigger `on auth.users insert` ou `upsert` no primeiro login |
| Eventos apagáveis | só `select` e `insert` (linhas 116-119) | adicionar `delete` do próprio usuário; é requisito de privacidade (6.5) |
| `recipe_id` | `references recipes` | `text not null` sem FK, com `check (char_length(recipe_id) between 1 and 128)` |
| IDs de feedback/evento | `default gen_random_uuid()` | aceitar `id` vindo do cliente (o app já gera `uid()` em `storage.ts`) para upsert idempotente |
| Volume de eventos | sem limite (o cliente corta em 500, `MAX_EVENTS`) | retenção (por exemplo, apagar `recipe_shown` com mais de 90 dias) ou agregação; `recipe_shown` cresce sem parar |
| `context_snapshot` | `jsonb not null` ilimitado | `check (pg_column_size(context_snapshot) < 2048)` |
| `onboarded` | gravado em `profiles` e também em `AppData` | decidir uma fonte; hoje existe nos dois |

Pergunta 6 do doc (política RLS ausente?): as políticas `for all` de `profiles`, `saved_recipes` e `recipe_feedback` cobrem o caso; a lacuna é `delete` em eventos e a ausência de `with check` explícito em `update` de eventos (não há update, o que é desejado). Pergunta 7: **substituir** o arquivo antes de aplicá-lo em qualquer ambiente; como nunca foi executado, não há migração a preservar, mas passar a usar `supabase/migrations/` versionadas.

### 6.2 Migração do `localStorage` no primeiro login (pergunta 5)

Objetivo: idempotente, sem sobrescrever dados existentes, sem duplicar.

1. Ao autenticar, ler `receita-da-hora:v1` (`loadData`), traduzir ids legados (2.2) e validar com o schema Zod existente.
2. **Salvos:** `upsert` por `(user_id, recipe_id)`; conflito mantém o `saved_at` mais antigo.
3. **Feedback e eventos:** `insert … on conflict (id) do nothing`, usando o `id` gerado no cliente. Repetir a migração é inofensivo.
4. **Perfil:** se existir `profiles.onboarded = true` no servidor, o servidor vence; senão sobe o perfil local. Se ambos existirem e divergirem, mostrar uma escolha em vez de decidir em silêncio.
5. Gravar uma marca local (`migratedFor: userId`) somente depois do sucesso; **não apagar** o `localStorage` até o usuário concluir ao menos uma sincronização bem-sucedida.
6. Em lote (uma chamada por tabela) e com limite de tamanho; falha parcial não bloqueia o app (continua local-first).

### 6.3 Sessão com Cache Components

O app é local-first e cliente. Para a primeira entrega de contas, o caminho mais simples é cliente Supabase no navegador para as tabelas privadas, com `@supabase/ssr` e `proxy.ts` apenas para renovar o cookie. Se alguma página passar a ler a sessão no servidor, `cookies()` precisa ficar dentro de `<Suspense>` e a leitura da sessão não pode estar dentro de `'use cache'` comum (use `'use cache: private'`); ver `01-app/02-guides/authentication-with-cache-components.md`. Isso afeta o formato do §9.4.

### 6.4 Redirect URLs por projeto

O §10.1 lista `https://*-seu-time.vercel.app/**` junto com localhost e produção, sem dizer em qual projeto Supabase. No projeto **de produção**, esse wildcard permitiria que qualquer deployment de preview do time (incluindo branches não revisadas) receba tokens de sessão de usuários reais. Configure:

| Projeto Supabase | Redirect URLs |
|---|---|
| produção | somente `https://app.seudominio.com/**` |
| staging | `http://localhost:3000/**` e o padrão de previews |

### 6.5 Privacidade (LGPD)

O schema já cita direito ao esquecimento; o doc de integração não trata do tema. Itens mínimos:
- Eventos de recomendação, cidade/país/timezone e preferências alimentares (podem revelar saúde/religião) são dados pessoais, possivelmente sensíveis. Definir base legal e consentimento explícito para o clima por localização.
- Exportação e exclusão de conta no próprio app (cascata por `auth.users` já existe; falta a interface e a exclusão pelo servidor, que exige `service_role` **apenas** em Route Handler server-side).
- Política de privacidade acessível antes do cadastro; retenção de eventos documentada (6.1).

### 6.6 Anti-abuso e entregabilidade

- CAPTCHA (Cloudflare Turnstile é uma opção natural) no cadastro e na recuperação de senha, para evitar uso do Resend como relay e esgotar a cota.
- Com SMTP próprio, o Supabase aplica um limite inicial baixo de e-mails por hora; ajustar em Authentication → Rate Limits antes do lançamento.
- Publicar SPF, DKIM **e DMARC** no domínio de envio; usar subdomínio dedicado (`email.`) para proteger a reputação do domínio principal.
- Ativar proteção contra senhas vazadas quando o plano permitir; definir tamanho mínimo.
- Login Google: vinculação automática de identidades pelo mesmo e-mail só é segura se o e-mail estiver verificado; manter confirmação de e-mail ativada.

---

## 7. Processo e ordem de execução

**Dois trilhos independentes.** O doc encadeia A → B → C, mas contas (Marco C) não dependem do catálogo: `saved_recipes` guarda um `recipe_id` textual. Executar em paralelo reduz o caminho crítico:

```text
Trilho Conteúdo: Marco 0 → A → B
Trilho Contas:   C (staging primeiro) → D parcial
                 └─ ponto de encontro: merge do localStorage usa ids do trilho Conteúdo
```

**Marco 0 (novo):**
1. Padronizar nomes de recursos e criar `env.staging` (2.4).
2. Importar as receitas atuais para o Studio com `legacy_ids` (2.2).
3. Criar a migration de metadados já com alérgenos "não declarado" bloqueando publicação (3.2).

**Marco B:** inclui webhook assinado e snapshot de build (4.2, 4.3). **Marco D:** passa a conter apenas observabilidade, alertas, rotação de segredos e remoção do fallback.

**Vercel:**
- `studio/` já é excluído do TypeScript do app (`tsconfig.json:39-42`); falta evitar que commits que só alteram `studio/` disparem deploy do app (Ignored Build Step ou `.vercelignore`).
- Confirmar que ESLint e Vitest da raiz não coletam arquivos de `studio/` (`vitest.config.ts`, `eslint.config.mjs`).
- Previews apontam para Studio **de staging** e Supabase **de staging** (já no doc, manter como critério de aceite).

---

## 8. Respostas às perguntas do §15

| # | Pergunta | Recomendação | Justificativa |
|---|---|---|---|
| 1 | JSON validado ou tabelas normalizadas? | JSON com Zod para `traits`, `weather_affinity`, `palette`, `nutrition`; vocabulário fechado em código para `meal_types`/`dietary_tags`; `ingredients_tags` derivado dos ingredientes | Os campos são lidos sempre em conjunto, o catálogo é pequeno e o filtro ocorre no app; tabelas só se justificam com consultas no D1 por tag |
| 2 | Versionar a API? | Sim, `/api/public/v1/catalog` com `schemaVersion` | Contrato novo, consumidor em produção; evolução sem quebrar |
| 3 | Cache/revalidação compatível com a versão instalada? | `'use cache'` + `cacheLife` + `cacheTag`, invalidado por `revalidateTag('catalog', { expire: 0 })` via webhook | `cacheComponents` já está ligado; o modelo antigo (`revalidate` em fetch) não é o caminho; cf. 2.5 e 4.2 |
| 4 | Server/client/provider? | `page.tsx` server busca o catálogo; `CatalogProvider` cliente entrega aos componentes | Evita waterfall e mantém a URL fora da UI; cf. 4.1 |
| 5 | Migração do `localStorage`? | Upsert por `(user_id, recipe_id)` e `on conflict (id) do nothing` com ids do cliente | Idempotente; cf. 6.2 |
| 6 | RLS ausente? | Falta `delete` em eventos; demais cobertas | cf. 6.1 |
| 7 | Dividir ou substituir o schema? | Substituir antes do primeiro apply e adotar `supabase/migrations/` | Nunca foi aplicado; as tabelas editoriais contradizem a arquitetura |
| 8 | ETag/Last-Modified/webhook? | Sim a ETag e `Last-Modified`; webhook assinado já no Marco B | 304 barato e invalidação imediata; cf. 3.1 e 4.2 |
| 9 | Ingrediente ausente / quantidade desconhecida / "a gosto"? | `quantity: number \| null` + `note` no tipo `Recipe` e na UI | Evita "0 g de sal"; cf. 3.3 |
| 10 | Testes e2e? | (a) Studio→API: smoke existente (`studio/scripts/smoke.mjs`) estendido ao catálogo; (b) contrato Zod/fixture nos dois lados; (c) Playwright (`e2e/journey.spec.ts`) contra o snapshot; (d) um teste noturno contra staging: publicar → webhook → aparece; despublicar → some | Cada camada falha por motivos diferentes |

---

## 9. Critérios de aceite adicionais

Acrescentar aos do §13 do documento original:

### Conteúdo e segurança alimentar
- [ ] Receita com `allergens = null` (não declarado) não publica, com mensagem específica.
- [ ] Metadado sugerido por IA não satisfaz a publicação sem confirmação humana registrada.
- [ ] Para cada alérgeno da fixture, nenhuma receita que o contenha é recomendada.
- [ ] Todos os ids legados presentes em um `localStorage` antigo resolvem para uma receita do novo catálogo (ou são descartados de forma documentada).

### Cache e integração
- [ ] Publicar e despublicar refletem no app em segundos com o webhook; sem ele, dentro do TTL documentado.
- [ ] Webhook com assinatura inválida, timestamp antigo ou corpo repetido é rejeitado (401) e registrado.
- [ ] Studio fora do ar: o app renderiza com o último bom ou o snapshot de build e registra o erro.
- [ ] Contrato fora do `schemaVersion` suportado falha de forma segura (não renderiza dados parciais).
- [ ] Receita salva despublicada não quebra `SavedRecipes` nem `Home` e tem comportamento definido.

### Cloudflare
- [ ] `content-api.*` retorna 404 para `/` e para qualquer `/api/*` fora de `/api/public/*`.
- [ ] Não há rota `workers.dev` nem URL de preview ativa fora do Access.

### Supabase e e-mail
- [ ] Repetir a migração do `localStorage` N vezes resulta no mesmo estado (sem duplicatas).
- [ ] Usuário apaga o próprio histórico de eventos; exclusão de conta remove todas as tabelas privadas.
- [ ] O projeto Supabase de produção não aceita redirect para domínios `*.vercel.app`.
- [ ] Cadastro exige CAPTCHA e respeita o limite de e-mails configurado.
- [ ] SPF, DKIM e DMARC válidos no domínio de envio.

---

## 10. Ordem sugerida de aplicação destas melhorias

1. Corrigir os itens **Bloqueante/Alto** da tabela (2.1–2.5, 3.2, 5.1, 6.4) no documento original antes de qualquer provisionamento.
2. Executar o Marco 0 (nomes, `env.staging`, importação, ids legados).
3. Implementar catálogo v1 + metadados + bloqueios de publicação (Studio).
4. Adapter, `CatalogProvider`, webhook e snapshot (app).
5. Em paralelo, Supabase staging + schema privado revisado + Auth + Resend + merge idempotente.
6. Endurecimento: rate limit, alertas, LGPD, rotação de segredos, remoção do fallback manual.
