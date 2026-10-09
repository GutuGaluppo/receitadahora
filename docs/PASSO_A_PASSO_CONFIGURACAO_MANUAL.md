# Passo a passo — configurações manuais da integração Studio → Receita da Hora

**Complementa:** [INTEGRACAO_STUDIO_PLANO_CONSOLIDADO.md](./INTEGRACAO_STUDIO_PLANO_CONSOLIDADO.md)
**Para quem:** quem tem acesso às contas Cloudflare, Vercel, Supabase, Resend e Google Cloud.
**Convenções:** `<dominio>` = seu domínio (ex.: `receitadahora.com.br`). Comandos rodam na raiz do repositório, salvo indicação.
Os nomes de menus dos painéis (Cloudflare, Supabase, Vercel, Resend, Google) mudam com frequência: se um rótulo não bater, procure pelo nome em itálico ou pela busca do painel.

> **O que já está pronto no código** (você não precisa programar nada): catálogo v1 no Studio, metadados + bloqueio de alérgenos, webhook assinado, host público minimizado, adapter + cache + snapshot no app, tradução de ids antigos, contas (e-mail/senha, Google, reset, confirmação), sincronização local → nuvem, exportação/exclusão de conta, migrations do Supabase.
> **O que só você pode fazer** (este documento): criar contas e recursos nos painéis, DNS, chaves, segredos, domínios, revisão editorial e decisões de produto.

---

## 0. Visão geral e ordem de execução

Faça nesta ordem. Cada fase tem um **ponto de verificação**; só avance se ele passar.

| # | Fase | Onde | Tempo aprox. |
|---|---|---|---|
| 1 | Decidir pendências e preparar domínio/contas | você | 30 min |
| 2 | Studio em **staging** (Cloudflare) | Cloudflare + terminal | 1–2 h |
| 3 | Supabase **staging** (banco + Auth) | Supabase + terminal | 1–2 h |
| 4 | E-mail transacional (Resend) + CAPTCHA (Turnstile) + Google | Resend, Cloudflare, Google Cloud | 1–2 h |
| 5 | App em **staging** (Vercel) | Vercel | 1 h |
| 6 | Importar e revisar o conteúdo (alérgenos!) | Studio | depende (35 receitas) |
| 7 | Testes ponta a ponta (gates A–D) | tudo | 1–2 h |
| 8 | Repetir 2–5 para **produção** e fazer o corte | tudo | 2–3 h |

**Regra de ouro:** staging e produção usam **recursos diferentes** em tudo (D1, R2, projeto Supabase, domínios, segredos). Nunca reaproveite uma chave entre os dois.

### Ferramentas locais

```bash
node -v            # precisa ser 22 ou superior
npm install        # na raiz
(cd studio && npm install)
npx wrangler login # abre o navegador; autorize a conta Cloudflare
npx supabase --version   # baixa o CLI na 1ª vez (npx supabase@latest)
```

### Mapa de domínios (sugestão)

| Host | Ambiente | Serve | Protegido por |
|---|---|---|---|
| `studio.<dominio>` | produção | painel do Studio + API admin | **Cloudflare Access** |
| `content-api.<dominio>` | produção | **somente** `/api/public/*` | público (somente leitura) |
| `app.<dominio>` | produção | app Next.js (Vercel) | público |
| `studio-staging.<dominio>` | staging | idem | Cloudflare Access (aplicação separada) |
| `content-api-staging.<dominio>` | staging | idem | público |
| `app-staging.<dominio>` | staging | app (Vercel, branch `staging`) | público (ou Deployment Protection, ver §5.4) |
| `email.<dominio>` | ambos | remetente dos e-mails de Auth (Resend) | — |

> O domínio precisa estar com o **DNS na Cloudflare** (zona ativa na sua conta) para os "Custom Domains" do Worker funcionarem. Se o domínio está em outro registrador, no registrador troque os *nameservers* pelos que a Cloudflare indicar (Cloudflare → *Add a domain*). Se não puder mover o domínio inteiro, delegue só um subdomínio.

---

## 1. Decisões pendentes (D-1 a D-8)

O código implementa a **recomendação** do plano em cada uma. Confirme ou mude — a coluna "se mudar" diz o custo.

| ID | Decisão | Como foi implementado | Se você discordar |
|---|---|---|---|
| **D-1** | Receita sem foto pode publicar? | Receitas **novas** exigem foto principal + fotos aprovadas de todos os ingredientes (regra antiga do Studio, inalterada). Receitas **importadas** do catálogo antigo (`legacy_import = 1`) publicam **sem foto** (o app desenha a ilustração) — mas continuam exigindo alérgenos revisados. | Para exigir foto também nas importadas: em `studio/src/worker/lib/publish.ts` troque `const needsImages = !r.metadata.legacy_import;` por `true` e produza as 35 imagens antes do corte. Para dispensar foto de ingrediente também nas novas: alterar `publish.ts` e `status.ts` (`missingIngredientAssets`). |
| D-2 | Taxonomia de alérgenos | Lista fechada em `contracts/catalog.ts` (`ALLERGENS`): leite, ovo, glúten, trigo, amendoim, castanhas, soja, peixe, camarão, frutos do mar, gergelim. | Edite a lista nesse arquivo (vale para Studio e app) e rode `npm run check` nos dois projetos. **Quem é o responsável editorial por revisá-la?** Anote o nome. |
| D-3 | Receita salva e despublicada | Aparece como **"Receita indisponível"** na Biblioteca, com botão de remover; nada é apagado. | Texto em `src/components/SavedRecipes.tsx`. |
| D-4 | Rubrica de `traits`/clima | Âncoras 0–100 exibidas no formulário (`studio/src/client/components/metadata.tsx`). | Ajuste os textos das âncoras com a equipe editorial. |
| D-5 | Domínios/contas/acesso de recuperação | **Você.** Crie as contas abaixo com e-mail de equipe (não pessoal) e ative 2FA em todas; guarde códigos de recuperação em cofre de senhas. | — |
| D-6 | Região, retenção, política de privacidade | Região sugerida: **São Paulo** (Supabase). Retenção de `recipe_shown`: 90 dias (§3.9). A página `/privacidade` é um **rascunho** — precisa de revisão jurídica e e-mail do encarregado (LGPD). | Edite `src/app/privacidade/page.tsx` após revisão. |
| D-7 | Rollout | staging → beta fechada → produção (§8). | — |
| D-8 | Responsáveis | Defina **uma pessoa** para: aprovar conteúdo/alérgenos, responder a incidente (despublicar) e rotacionar segredos. | — |

---

## 2. Cloudflare — Studio em staging

### 2.1 Criar o banco D1 e o bucket R2 de staging

```bash
cd studio
npx wrangler d1 create receita-da-hora-studio-staging
# → imprime "database_id": "xxxxxxxx-xxxx-..." — COPIE
npx wrangler r2 bucket create receita-da-hora-assets-staging
```

> R2 exige ativar o produto uma vez: Cloudflare → *R2 Object Storage* → *Purchase/Enable* (plano gratuito cobre o início, mas pede cartão).

### 2.2 Proteger o Studio com Cloudflare Access (faça ANTES de abrir o domínio)

1. Cloudflare → **Zero Trust** (na 1ª vez escolha um *team name*, ex.: `receitadahora`; o plano Free atende até 50 usuários).
2. Anote o **Team domain**: Zero Trust → *Settings* → *General* → algo como `receitadahora.cloudflareaccess.com`.
3. Zero Trust → *Access* → *Applications* → **Add an application** → **Self-hosted**.
   - Application name: `Studio (staging)`
   - Domain: `studio-staging.<dominio>` (sem caminho)
   - Policy: *Allow* → *Include* → *Emails* → liste os e-mails da equipe editorial. (Método de login: *One-time PIN* já vem habilitado.)
4. Salve. Abra a aplicação criada → *Overview* → copie o **Application Audience (AUD) Tag**.
5. **Não** crie aplicação Access para `content-api-staging.<dominio>` — ela precisa ser pública.

### 2.3 Preencher `studio/wrangler.jsonc` (bloco `env.staging`)

Substitua cada `REPLACE_WITH_…`:

| Chave | Valor |
|---|---|
| `d1_databases[0].database_id` | id copiado em 2.1 |
| `CF_ACCESS_TEAM_DOMAIN` | `receitadahora.cloudflareaccess.com` (sem `https://`) |
| `CF_ACCESS_AUD` | AUD tag de 2.2 |
| `PUBLIC_API_HOSTNAME` | `content-api-staging.<dominio>` (só o hostname) |
| `APP_ORIGIN` | `https://app-staging.<dominio>` |
| `APP_REVALIDATE_URL` | `https://app-staging.<dominio>/api/revalidate` |
| `routes[].pattern` | `studio-staging.<dominio>` e `content-api-staging.<dominio>` |

> `PUBLIC_API_HOSTNAME` é o que faz o Worker responder **404 para tudo que não seja `/api/public/*`** nesse host. Se errar o hostname, o host público ficará aberto como o Studio (protegido só pelo login da API). Teste em 2.7.

### 2.4 Gerar e gravar os segredos (staging)

```bash
openssl rand -hex 32           # copie a saída: este é o SEGREDO DO WEBHOOK de staging
cd studio
npx wrangler secret put APP_REVALIDATE_SECRET --env staging     # cole o valor quando pedir
```

Guarde o valor num cofre de senhas: ele também vai para o Vercel (§5.3) como `STUDIO_REVALIDATE_SECRET`. **Os dois lados precisam ser idênticos.**

### 2.5 Migrar e publicar

```bash
cd studio
npm run db:migrate:staging     # aplica 0001, 0002, 0003 (responda "y")
npm run deploy:staging         # vite build + wrangler deploy --env staging
```

O deploy cria os *Custom Domains* automaticamente (cria os registros DNS e certificados). Pode levar alguns minutos. Se falhar com "domain not in account", o domínio não está na sua conta Cloudflare (ver §0).

### 2.6 Regra de limite de requisições no host público (recomendado)

Cloudflare → sua zona → *Security* → *WAF* → *Rate limiting rules* → **Create**:
- Se: *Hostname* **equals** `content-api-staging.<dominio>`
- Mesmo IP, **300 requisições / 10 segundos** → *Block* por 10 segundos (ajuste depois com dados reais).

Repita em produção com o hostname de produção.

### 2.7 Verificação da fase 2 (Gate C parcial)

```bash
# 1) host público: só /api/public responde
curl -s -o /dev/null -w "%{http_code}\n" https://content-api-staging.<dominio>/                      # esperado 404
curl -s -o /dev/null -w "%{http_code}\n" https://content-api-staging.<dominio>/api/recipes           # esperado 404
curl -s https://content-api-staging.<dominio>/api/public/v1/catalog                                  # esperado {"schemaVersion":1,...,"recipes":[]}

# 2) admin sem login: nunca 200 com dados
curl -s -o /dev/null -w "%{http_code}\n" https://studio-staging.<dominio>/api/recipes                # esperado 302/401/403 (Access)

# 3) workers.dev desligado
curl -s -o /dev/null -w "%{http_code}\n" https://receita-da-hora-studio-staging.<sua-conta>.workers.dev/   # esperado falha/404
```

No navegador: `https://studio-staging.<dominio>` deve pedir login (Access) e, após o PIN por e-mail, abrir o painel.

---

## 3. Supabase — projeto de staging

### 3.1 Criar o projeto

1. <https://supabase.com/dashboard> → *New project*. Nome: `receita-da-hora-staging`.
2. **Region:** *South America (São Paulo)*. Defina uma senha forte do banco e guarde.
3. Crie depois um **segundo projeto** `receita-da-hora-prod` (pode esperar a fase 8).

### 3.2 Aplicar o schema privado

```bash
npx supabase login                       # abre o navegador
npx supabase init                        # só na 1ª vez: cria supabase/config.toml (commite)
npx supabase link --project-ref <REF>    # REF = trecho de https://<REF>.supabase.co (Settings → General → Reference ID)
npx supabase db push                     # aplica supabase/migrations/20261008000000_private_schema.sql
```

Confirme em *Table Editor*: `profiles`, `saved_recipes`, `recipe_feedback`, `recommendation_events`, todas com **RLS enabled**.

### 3.3 Testar a RLS com dois usuários (Gate D)

Dashboard → *SQL Editor* → cole todo o conteúdo de `supabase/tests/rls_two_users.sql` → *Run*.
Esperado: todas as linhas `ASSERT …` com `ok = true`, nenhuma exceção `FALHA:`; o script termina em `rollback` (não deixa dados). **Rode só em staging.**

### 3.4 Chaves da API

*Project Settings* → *API Keys*:
- **Publishable key** (`sb_publishable_…`) → vai para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Pode ser pública.
- **Secret key** (`sb_secret_…`, ou a *service_role* legada) → vai **somente** para `SUPABASE_SERVICE_ROLE_KEY` no Vercel (servidor). Nunca em `NEXT_PUBLIC_*`, nunca no Git.
- **Project URL** (`https://<REF>.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`.

### 3.5 Autenticação: URLs

*Authentication* → *URL Configuration*:
- **Site URL:** `https://app-staging.<dominio>`
- **Redirect URLs** (uma por linha):
  ```
  http://localhost:3000/**
  https://app-staging.<dominio>/**
  ```
  (Se quiser testar previews do Vercel no staging, acrescente o padrão `https://*-<seu-time>.vercel.app/**`.)

> **Produção:** somente `https://app.<dominio>/**`. **Nunca** `*.vercel.app` no projeto de produção (Gate D).

### 3.6 Autenticação: e-mail/senha, política e proteção

*Authentication* → *Sign In / Providers* → **Email**:
- *Enable Email provider*: ligado. *Confirm email*: **ligado** (obrigatório — sem isso a vinculação com Google não é segura).
- *Minimum password length*: **10** (o app já exige 10 no formulário).
- *Leaked password protection* (senhas vazadas): ligue **se o seu plano permitir** (costuma ser plano Pro). Sem o plano, anote como risco aceito.

### 3.7 Templates de e-mail em português (obrigatório)

*Authentication* → *Emails* → *Templates*. Os links usam `token_hash` (funcionam mesmo se a pessoa abrir o e-mail em outro dispositivo) e apontam para as rotas do app (`/auth/confirm`). Desative qualquer opção de *click tracking* (no Resend, ver §4).

**Confirm signup** — Subject: `Confirme seu e-mail — Receita da Hora`

```html
<h2>Bem-vindo ao Receita da Hora</h2>
<p>Confirme seu e-mail para ativar sua conta:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirmar e-mail</a></p>
<p>Se você não criou uma conta, ignore esta mensagem.</p>
```

**Reset password** — Subject: `Redefinir sua senha — Receita da Hora`

```html
<h2>Redefinir senha</h2>
<p>Use o link abaixo para escolher uma nova senha. Ele expira em pouco tempo.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset">Escolher nova senha</a></p>
<p>Se você não pediu isso, ignore esta mensagem — sua senha continua a mesma.</p>
```

(Opcional: traduza também *Magic link*, *Change email* e *Invite*; o app não usa magic link nem convite.)

> Como o link usa `{{ .SiteURL }}`, **teste os e-mails sempre no domínio estável de staging** (`app-staging…`), não em URLs aleatórias de preview.

### 3.8 CAPTCHA e limites de e-mail

- *Authentication* → *Attack Protection* → **Enable CAPTCHA protection** → provedor **Cloudflare Turnstile** → cole a **Secret key** criada em §4.3. (O app só mostra o widget se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` estiver definido; ligue um lado só quando o outro estiver pronto, senão o cadastro falha.)
- *Authentication* → *Rate Limits*: depois de configurar SMTP próprio (§4.2), aumente "emails sent per hour" para um valor coerente com seu volume (ex.: 100). O padrão com SMTP próprio é baixo e trava lançamentos.

### 3.9 Retenção de eventos (LGPD / volume)

*Integrations* → **Cron** (ative a extensão `pg_cron` se pedir) → *Create job*:
- Nome: `purge-recipe-shown`; schedule: `0 3 * * *` (todo dia 03:00 UTC)
- Tipo: SQL snippet → `select public.purge_old_events(90);`

Isso apaga eventos `recipe_shown` com mais de 90 dias. Ajuste os dias conforme sua decisão D-6 e documente na política de privacidade.

---

## 4. Resend, Turnstile e Google

### 4.1 Resend: domínio de envio

1. <https://resend.com> → criar conta → *Domains* → **Add Domain** → `email.<dominio>` (subdomínio dedicado) → região mais próxima (ex.: *São Paulo* se disponível).
2. Resend mostra registros DNS (**SPF**, **DKIM**, às vezes **MX** de retorno). Crie-os em Cloudflare → *DNS* → *Records* exatamente como mostrados (deixe a nuvem **cinza**/“DNS only” nesses registros).
3. Crie também o **DMARC** (manualmente), registro TXT em `_dmarc.email.<dominio>`:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@<dominio>
   ```
   Comece com `p=none` (monitorar); depois de algumas semanas sem falsos positivos, suba para `p=quarantine`.
4. Volte ao Resend → *Verify DNS Records*. Aguarde ficar **Verified**.
5. *Settings* → **Click tracking e Open tracking: desligados** para o domínio (e-mails de Auth não podem ter links reescritos).
6. *API Keys* → **Create API Key** → permissão *Sending access* → domínio `email.<dominio>`. Copie (aparece uma vez). Use uma chave por ambiente.

### 4.2 Resend como SMTP do Supabase

Supabase → *Authentication* → *Emails* → **SMTP Settings** → *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@email.<dominio>` |
| Sender name | `Receita da Hora` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a API key do Resend |

Salve. Teste: crie uma conta no app de staging e veja se o e-mail chega (confira *Spam* e o painel do Resend → *Emails*). **A chave do Resend fica só aqui, nunca no Vercel nem no Git.**

### 4.3 Turnstile (CAPTCHA)

Cloudflare → *Turnstile* → **Add widget**:
- Nome `Receita da Hora (staging)`; domínios: `app-staging.<dominio>` e `localhost`; modo *Managed*.
- Copie **Site key** (pública → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no Vercel) e **Secret key** (→ painel do Supabase, §3.8).
- Crie outro widget para produção (domínio `app.<dominio>`).

### 4.4 Google OAuth

1. <https://console.cloud.google.com> → crie um projeto `receita-da-hora`.
2. *APIs & Services* → **OAuth consent screen** (ou *Google Auth Platform*): tipo *External*; nome do app; e-mail de suporte; domínio `<dominio>`; links de **política de privacidade** (`https://app.<dominio>/privacidade`) e termos. Escopos: apenas `openid`, `email`, `profile` (padrão; não peça mais que isso). Em *Publishing status*, mude de *Testing* para **In production** quando for aos usuários reais (em *Testing* só contas cadastradas como testadoras entram).
3. *Credentials* → **Create credentials** → *OAuth client ID* → tipo **Web application**:
   - *Authorized JavaScript origins:* `http://localhost:3000`, `https://app-staging.<dominio>`, `https://app.<dominio>`
   - *Authorized redirect URIs:* **exatamente** `https://<REF-STAGING>.supabase.co/auth/v1/callback` e `https://<REF-PROD>.supabase.co/auth/v1/callback` (o redirect é do **Supabase**, não do seu app).
4. Copie **Client ID** e **Client secret**.
5. Supabase → *Authentication* → *Sign In / Providers* → **Google** → ligue, cole Client ID e Secret, salve. (Use um OAuth client por ambiente se quiser separar totalmente; senão o mesmo funciona com os dois redirects.)

---

## 5. Vercel — app em staging

### 5.1 Projeto

1. <https://vercel.com/new> → importe o repositório. **Root Directory:** `.` (a raiz). `studio/` **não** é projeto Vercel. Framework: Next.js. Node: 22.x (Settings → General → Node.js Version).
2. O `vercel.json` já define um *Ignored Build Step*: commits que só mexem em `studio/`, `docs/` ou `supabase/` **não** disparam deploy do app.
3. Crie a branch `staging` no Git e faça push — será o ambiente de staging estável.

### 5.2 Domínios

Settings → *Domains*:
- `app.<dominio>` → ambiente **Production** (branch `main`).
- `app-staging.<dominio>` → *Add* e atribua à branch **`staging`**.
Siga as instruções de DNS do Vercel (CNAME/A) na Cloudflare; deixe "DNS only" (nuvem cinza) nesses registros para evitar conflitos de certificado.

### 5.3 Variáveis de ambiente

Settings → *Environment Variables*. Marque o escopo correto e, para staging, **Preview → Git branch = `staging`**.

| Variável | Production | Preview (branch `staging`) | Observação |
|---|---|---|---|
| `STUDIO_PUBLIC_API_URL` | `https://content-api.<dominio>` | `https://content-api-staging.<dominio>` | **sem** `NEXT_PUBLIC_` |
| `STUDIO_REVALIDATE_SECRET` | segredo HMAC de **produção** | segredo HMAC de **staging** (§2.4) | marque *Sensitive* |
| `SNAPSHOT_MAX_AGE_HOURS` | `72` | `72` | |
| `CATALOG_BLOCKLIST` | (vazio) | (vazio) | usado no incidente (§9) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto **prod** | URL do projeto **staging** | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable **prod** | publishable **staging** | |
| `NEXT_PUBLIC_SITE_URL` | `https://app.<dominio>` | `https://app-staging.<dominio>` | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key prod | site key staging | opcional até §3.8 |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key **prod** | secret key **staging** | marque *Sensitive*; só servidor |

**Development** (opcional, `vercel env pull`): deixe vazio → o app roda em modo local com o catálogo de exemplo.

> Variáveis `NEXT_PUBLIC_*` são gravadas **no build**; mudar uma exige **novo deploy** (Deployments → ⋯ → *Redeploy*). O mesmo vale para as demais: mudar valor não atualiza deploys já feitos.

### 5.4 Webhook x Deployment Protection

Se o staging estiver atrás de *Vercel Authentication/Deployment Protection*, o `POST /api/revalidate` do Studio recebe 401 e a invalidação não chega (o TTL de ~5 min recupera, mas fica lento). Soluções (uma delas):
- Settings → *Deployment Protection* → desative a proteção para o domínio de staging; **ou**
- Ative **Protection Bypass for Automation**, copie o token e grave no Worker: `cd studio && npx wrangler secret put APP_REVALIDATE_BYPASS --env staging` (o Worker envia o cabeçalho `x-vercel-protection-bypass`).

### 5.5 Primeiro deploy

Faça push na branch `staging`. O build executa `prebuild` (`node scripts/snapshot-catalog.mjs`):
- com `STUDIO_PUBLIC_API_URL` apontando para um catálogo **vazio** o script mantém o snapshot de exemplo (de propósito);
- depois que houver receitas publicadas (fase 6), um novo deploy grava o snapshot **do Studio** — é ele que serve de contingência.

**Verificação:** `https://app-staging.<dominio>` abre; a tela mostra "Estamos preparando as receitas" enquanto o Studio não tem nada publicado (isso é o esperado — o app **não** recomenda a partir de conteúdo não confiável).

### 5.6 Atualização diária do snapshot (recomendado)

O snapshot expira em 72 h. Para renová-lo sozinho:
1. Vercel → Settings → *Git* → **Deploy Hooks** → crie `snapshot-production` (branch `main`) → copie a URL.
2. GitHub → repositório → Settings → *Secrets and variables* → *Actions* → novo secret `VERCEL_DEPLOY_HOOK_PRODUCTION` = a URL.
3. O workflow `.github/workflows/refresh-catalog-snapshot.yml` já está no repositório e roda todo dia às 08:00 UTC (você também pode disparar manualmente em *Actions*).

---

## 6. Conteúdo — importar, revisar alérgenos e publicar

### 6.1 Importar as 35 receitas atuais (Marco 0)

```bash
cd studio
npm run import:legacy        # regenera seed/legacy-import.sql a partir de src/data/recipes.ts
npx wrangler d1 execute DB --env staging --remote --file=seed/legacy-import.sql
```

É idempotente (pode repetir). Cada receita entra como **Aprovada**, marcada como importada, com o id antigo em `legacy_ids`, e com **alérgenos NÃO revisados** (não publica ainda).

### 6.2 Revisar cada receita (trabalho humano obrigatório)

No Studio (`studio-staging.<dominio>`) → *Receitas* → abra cada receita → card **Metadados de recomendação**:
1. Confira refeições, dietas, culinária, paleta, perfil (0–100) e clima — já vêm preenchidos do catálogo antigo.
2. **Marque os alérgenos presentes** (lista fechada). Receita sem nenhum alérgeno: deixe tudo desmarcado — a confirmação abaixo vale como "revisado, nenhum".
3. Marque *"Confirmo que revisei…"* e clique **Confirmar metadados** (fica registrado seu usuário e a data).
4. O card *Status* deve passar a mostrar nenhum bloqueio → **Publicar**.

> **Segurança alimentar:** o app bloqueia a receita para quem declarou aquele alérgeno olhando os "termos de ingredientes" + os nomes dos ingredientes. Revise com atenção derivados (ex.: *creme de leite*, *parmesão* → leite; *macarrão* → glúten/trigo; *maionese* → ovo).

### 6.3 Receitas novas (fluxo normal)

Criar/gerar → imagem principal aprovada → imagens de todos os ingredientes aprovadas → revisão aprovada → **Metadados confirmados** → Publicar. Metadados sugeridos por IA **não** existem: a Content Factory não preenche esses campos.

### 6.4 Gravar o snapshot real

Depois de publicar, force um deploy da branch `staging` (push vazio ou *Redeploy*) para o `prebuild` gravar `catalog.snapshot.json` com `"source": "studio"`. No log do build deve aparecer `✔ snapshot do Studio: N receitas`.

---

## 7. Testes ponta a ponta (fechamento dos gates)

Faça em **staging**, anotando data/resultado.

### Gate A/C — conteúdo e atualização
- [ ] Receita em rascunho/revisão/aprovada **não** aparece em `/api/public/v1/catalog`.
- [ ] Publicar uma receita → em **segundos** aparece no app (recarregue `app-staging…`) sem deploy.
- [ ] **Despublicar** → some do app em segundos. (Abas já abertas só atualizam ao voltar o foco depois de ~5 min — comportamento documentado.)
- [ ] Webhook adulterado é rejeitado:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app-staging.<dominio>/api/revalidate \
    -H "x-studio-timestamp: 1" -H "x-studio-signature: deadbeef" -d '{}'      # esperado 401
  ```
- [ ] Studio "fora do ar": pare o Worker (ou aponte `STUDIO_PUBLIC_API_URL` para um host inválido num deploy de teste) → o app mostra o snapshot recente (log `catalog_snapshot_used` no Vercel).
- [ ] Defina `CATALOG_BLOCKLIST=<id da receita>` no Vercel, redeploy, e repita o item anterior: a receita **não** aparece no fallback.
- [ ] Cadastre-se com alergia a "leite" no onboarding e confirme que receitas com leite nunca são sugeridas.
- [ ] Receita com ingrediente "a gosto" nunca mostra "0 g".

### Gate D — contas e privacidade
- [ ] RLS: `supabase/tests/rls_two_users.sql` passou (§3.3).
- [ ] Criar conta → e-mail chega em português, link abre o app logado.
- [ ] Abrir o link do e-mail **em outro navegador/dispositivo** também funciona.
- [ ] "Esqueci a senha" mostra a mesma mensagem exista ou não o e-mail; o link leva a `/auth/reset`; a nova senha funciona.
- [ ] Entrar com Google; sair; entrar de novo.
- [ ] Em outro dispositivo/perfil do navegador: login → salvos e gostos aparecem.
- [ ] Migração do `localStorage`: com dados locais (antes de ter conta), crie a conta e confirme que salvos/feedback foram para a nuvem (Supabase → Table Editor). Entre/saia 3 vezes: **sem duplicatas**.
- [ ] Biblioteca → Conta: **Exportar meus dados**, **Apagar meu histórico** e **Excluir minha conta** funcionam (esta remove o usuário em *Authentication → Users* e suas linhas).
- [ ] Logout não apaga dados remotos.
- [ ] Projeto de produção rejeita redirect `*.vercel.app` (tente adicionar ao `redirectTo`: o Supabase deve cair na Site URL).
- [ ] DNS de e-mail: em <https://mxtoolbox.com/SuperTool.aspx> confira SPF, DKIM e DMARC de `email.<dominio>`.

### Verificação automatizada (sempre antes de promover)
```bash
npm run check && npm run build         # raiz: lint + tipos + testes + build
(cd studio && npm run check)           # Studio
npm run e2e                            # jornada completa (modo local)
```

---

## 8. Produção — repetir e fazer o corte

1. **Cloudflare:** repita §2 com `production`: D1 `receita-da-hora-studio-prod`, R2 `receita-da-hora-assets-prod`, **outra** aplicação Access (outro AUD), outro segredo HMAC (`openssl rand -hex 32` novo!), `wrangler secret put APP_REVALIDATE_SECRET --env production`, `npm run db:migrate:production`, `npm run deploy:production`, regra de rate limit, testes de §2.7.
2. **Importação e revisão:** §6 contra `--env production --remote`. (Ou, mais seguro: revise tudo em staging e só então importe/revise em produção.)
3. **Supabase produção:** novo projeto; `npx supabase link --project-ref <REF-PROD>` → `npx supabase db push`; URL Configuration **somente** `https://app.<dominio>/**`; mesmos templates; SMTP; CAPTCHA; Google; cron de retenção. Rode §3.3 também lá? **Não** — o script é para staging; em produção basta confirmar RLS ligada nas 4 tabelas.
4. **Vercel produção:** variáveis de *Production* (§5.3), domínio `app.<dominio>`, deploy da `main`.
5. **Beta controlada:** libere o link só para um grupo pequeno por alguns dias; acompanhe os logs do Vercel (`catalog_unavailable`, `catalog_snapshot_used`, `revalidate_rejected`) e o painel do Resend (bounces).
6. **Corte:** divulgue. O fallback manual antigo (`src/data/recipes.ts`) permanece só como fonte de testes/seed; **remova-o do runtime após um período estável** (ele já não é usado pelo app).

---

## 9. Operação e incidentes

| Situação | Ação |
|---|---|
| Receita publicada com alérgeno errado | Studio → corrigir o metadado (efeito imediato) **ou** Despublicar. Se o Studio estiver fora: Vercel → `CATALOG_BLOCKLIST=<id>` + Redeploy (bloqueia no fallback). Avalie sessões abertas (até ~5 min). |
| Webhook não chega | O app se atualiza sozinho em até ~5 min (TTL). Cheque `revalidate_rejected` nos logs (segredo diferente? relógio?) e o §5.4. |
| Studio fora do ar | O app usa o snapshot (≤ 72 h) e registra `catalog_snapshot_used`. Restaure o Worker. Acima de 72 h o app entra em estado degradado (por segurança). |
| Supabase fora do ar | O app continua em modo local; nada é perdido; a sincronização retoma sozinha. |
| Deploy ruim do app | Vercel → *Deployments* → deploy anterior → *Promote to Production*. |
| Vazou um segredo | Gere outro, grave nos dois lados (Worker + Vercel), redeploy. HMAC: troque `APP_REVALIDATE_SECRET` e `STUDIO_REVALIDATE_SECRET`. Supabase: *API Keys* → regenerar. Resend: criar nova chave e atualizar o SMTP. |

Rotação sugerida: segredos a cada 6–12 meses e sempre que alguém com acesso sair da equipe.

---

## 10. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Studio responde `503 Cloudflare Access não está configurado` | `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` ainda com `REPLACE_WITH_…` ou sem redeploy. |
| `content-api` mostra o painel do Studio | `PUBLIC_API_HOSTNAME` errado/ausente no `env` correto. |
| Deploy do Worker falha em "custom domain" | Zona do domínio não está na sua conta Cloudflare / DNS não ativo. |
| App em staging sempre "Estamos preparando as receitas" | Nenhuma receita publicada **com alérgenos revisados**, ou `STUDIO_PUBLIC_API_URL` errada, ou contrato inválido (veja log `catalog_unavailable`). |
| Cadastro dá erro "Não foi possível concluir" | CAPTCHA ligado no Supabase sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (ou vice-versa); SMTP/limite de e-mails; senha < 10 caracteres. |
| E-mail não chega | DNS do Resend não verificado; remetente diferente do domínio verificado; caiu no spam; limite de envios do Supabase. |
| Link do e-mail volta para `/?auth=link_invalido` | Link expirado/usado, template sem `token_hash`, ou Site URL errada para aquele ambiente. |
| Google: `redirect_uri_mismatch` | O redirect cadastrado no Google não é exatamente `https://<REF>.supabase.co/auth/v1/callback`. |
| Google: "app não verificado" / só alguns entram | Tela de consentimento ainda em *Testing*; publique (*In production*). |
| Excluir conta falha (`not_configured`) | `SUPABASE_SERVICE_ROLE_KEY` ausente no Vercel. |
| Preview do Vercel não loga | A URL aleatória do preview não está nos *Redirect URLs* do projeto de staging (use o domínio fixo de staging). |

---

## 11. Checklist final (cole numa issue e marque)

**Contas e acesso (D-5)**: Cloudflare ☐ Vercel ☐ Supabase ☐ Resend ☐ Google Cloud ☐ GitHub ☐ — 2FA ligado e códigos de recuperação guardados ☐
**Cloudflare**: D1 staging/prod ☐ R2 staging/prod ☐ Access (2 aplicações, AUD distintos) ☐ domínios do Worker ☐ `PUBLIC_API_HOSTNAME` ☐ secrets (`APP_REVALIDATE_SECRET`) ☐ rate limit ☐ Turnstile (2 widgets) ☐
**Supabase (×2)**: schema aplicado ☐ RLS testada (staging) ☐ URL Configuration ☐ e-mail + confirmação ☐ senha ≥ 10 ☐ templates pt-BR ☐ SMTP Resend ☐ CAPTCHA ☐ Google ☐ rate limit de e-mail ☐ cron de retenção ☐
**Resend**: domínio verificado (SPF/DKIM) ☐ DMARC ☐ tracking desligado ☐ chave por ambiente ☐
**Vercel**: projeto na raiz ☐ domínios ☐ variáveis por ambiente ☐ segredo HMAC igual ao do Worker ☐ proteção/bypass do staging ☐ deploy hook + secret do GitHub ☐
**Conteúdo**: importação ☐ alérgenos das 35 receitas revisados ☐ publicadas ☐ snapshot `source: studio` gravado ☐
**Jurídico/produto**: política de privacidade revisada e com e-mail do encarregado ☐ D-1…D-8 respondidas e registradas ☐ responsável por incidentes definido ☐
**Gates A–D** marcados em §7 ☐
