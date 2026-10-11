# Integração do Receita da Hora Studio com o app público

**Status:** proposta de arquitetura e roteiro de implementação  
**Público:** equipe de produto/engenharia e revisão técnica por Claude Code  
**Última atualização:** 8 de outubro de 2026

## 1. Objetivo

Transformar o **Receita da Hora Studio** na fonte de verdade editorial do produto. Quando uma receita for revisada e publicada no Studio, o aplicativo público **Receita da Hora** deverá consumi-la automaticamente, incluindo seus dados, ingredientes e imagens aprovadas — sem copiar manualmente conteúdo entre projetos nem exigir novo deploy do app público.

Em paralelo, o app público passará a ter contas de usuário reais:

- cadastro e autenticação por e-mail/senha;
- login social via OAuth (Google como primeiro provedor);
- confirmação de e-mail e recuperação de senha enviadas por Resend;
- persistência privada de perfil, receitas salvas, feedbacks e eventos de recomendação no Supabase;
- deploy do app Next.js pela Vercel.

O objetivo não é colocar todos os dados no mesmo banco. O desenho correto separa **conteúdo editorial** de **dados pessoais e de comportamento**, respeitando as responsabilidades que já existem no repositório.

## 2. Decisão arquitetural

```text
┌───────────────────────────────────────────────────────────────────────┐
│                      Cloudflare: Receita da Hora Studio               │
│                                                                       │
│  painel interno ──► Worker ──► D1: receitas, ingredientes, estados   │
│                                  R2: imagens e assets                 │
│                         │                                             │
│                         └── /api/public/* (somente conteúdo publicado)│
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │ HTTPS, leitura pública
                                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                   Vercel: Receita da Hora (Next.js)                  │
│                                                                       │
│  servidor Next.js ──► adapter/validação/cache ──► catálogo Studio    │
│  navegador ──► Supabase Auth + Postgres (dados do próprio usuário)   │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │ SMTP
                                  ▼
                         ┌──────────────────┐
                         │      Resend      │
                         │ e-mails de Auth  │
                         └──────────────────┘
```

### 2.1 Divisão de responsabilidades

| Sistema | Deve ser responsável por | Não deve ser responsável por |
|---|---|---|
| Studio + D1 | receita editorial, ingredientes globais, aprovação, publicação, estado do conteúdo | contas públicas, senhas, feedback individual, favoritos individuais |
| R2 | binários de imagens aprovadas | lógica de acesso ou metadados editoriais |
| Worker do Studio | API pública de leitura e API administrativa protegida | autenticação de consumidores do app público |
| Supabase Auth | identidade, sessão, e-mail/senha e OAuth | autorização administrativa do Studio |
| Supabase Postgres | perfil, receitas salvas, feedback, eventos do usuário | cópia da biblioteca editorial do Studio |
| Resend | entrega dos e-mails transacionais de Auth via SMTP | estado da sessão ou usuários |
| Vercel | executar e distribuir o app Next.js | acesso direto a D1, R2 ou segredos Cloudflare |

Esta separação evita dois problemas caros de manter: duplicação de conteúdo e exposição de dados sensíveis. O Studio já tem regras de publicação e uma API pública que garante que rascunhos, itens rejeitados e assets não aprovados não sejam expostos. Reimplementar essas regras no Supabase ou no Next.js criaria duas fontes de verdade com comportamento divergente.

## 3. Cenário atual confirmado no repositório

### 3.1 App público (`/`)

- É um app **Next.js 16**, React 19 e TypeScript.
- As receitas são carregadas estaticamente de `src/data/recipes.ts`.
- `Home`, `Onboarding` e `SavedRecipes` importam diretamente esse catálogo estático.
- O algoritmo em `src/services/recommendation.ts` recebe objetos do tipo `Recipe` e usa, entre outros, `mealTypes`, `dietaryTags`, `ingredientsTags`, `traits`, `weatherAffinity`, `cuisine` e `active`.
- A persistência atual é local-first: `src/services/storage.ts` armazena perfil, salvos, feedback e eventos no `localStorage`.
- Já existe `supabase/schema.sql`, mas ele é apenas um alvo de persistência futura; o app ainda não possui cliente Supabase, rotas de autenticação nem sessão.

### 3.2 Studio (`/studio`)

- É uma aplicação separada, com Vite no frontend e Cloudflare Worker/Hono no backend.
- D1 armazena `recipes`, `ingredients`, `assets`, `batches` e relações; R2 armazena os arquivos.
- O Worker já diferencia API administrativa (`/api/*`) de API pública (`/api/public/*`).
- As rotas públicas existentes são:
  - `GET /api/public/recipes`
  - `GET /api/public/recipes/:slug`
  - `GET /api/public/categories`
  - `GET /api/public/assets/*`
- A API pública filtra receitas com status `published` e assets com status `approved`.
- A área administrativa exige JWT do Cloudflare Access em produção; o modo de bypass é aceito apenas em desenvolvimento.
- A resposta pública atual entrega campos editoriais básicos, como nome, descrição, categoria, tempo, porções, dificuldade, instruções, ingredientes e imagem.

### 3.3 Lacuna que impede uma integração correta hoje

O contrato público do Studio **ainda não contém todos os dados necessários para o algoritmo de recomendação do app**. Exemplos:

| Necessidade do app | Disponível no Studio hoje? | Consequência sem o campo |
|---|---:|---|
| tipos de refeição (`breakfast`, `lunch` etc.) | Não de forma estruturada | sugestão pode ignorar horário |
| tags dietéticas | Não | filtros vegetariano/vegano e restrições falham |
| tags de ingredientes/alergênicos | Parcialmente derivável, mas não normalizada como contrato | hard stops podem ser imprecisos |
| culinária | Não | perde diversidade por culinária |
| atributos de conforto, leveza, proteína, custo e novidade | Não | ranking perde seus sinais principais |
| afinidade climática | Não | recomendação deixa de responder ao clima |
| paleta visual e nutrição | Não | interface e informações ficam incompletas |

Trocar simplesmente o import estático por um `fetch` deixaria o app aparentemente funcional, mas degradaria filtros de alergia, personalização, diversidade e recomendação climática. Essa é uma regressão de produto inaceitável. A primeira etapa técnica deve fechar esse contrato.

## 4. Princípios obrigatórios

1. **Uma fonte de verdade para conteúdo:** D1/Studio, nunca uma réplica manual no Supabase.
2. **Publicação é o contrato:** somente a transição explícita para `published` disponibiliza uma receita ao app.
3. **Dados de usuário são isolados:** políticas RLS do Supabase devem permitir apenas que cada usuário leia/escreva seus próprios dados.
4. **Segredo não vai ao navegador:** nenhuma chave administrativa, de serviço, SMTP ou Cloudflare pode ter prefixo `NEXT_PUBLIC_`.
5. **Preview não usa produção:** ambientes de staging/preview precisam de conteúdo e autenticação próprios.
6. **Integração gradual e reversível:** o catálogo estático permanece como fallback até os critérios de aceite serem cumpridos.
7. **Falhar de forma segura:** se a API do Studio estiver indisponível, o app deve manter uma experiência útil, registrar o erro e nunca expor conteúdo em revisão.

## 5. Arquitetura alvo de domínios e ambientes

### 5.1 Domínios sugeridos

| Hostname | Serviço | Visibilidade |
|---|---|---|
| `app.seudominio.com` | Receita da Hora no Vercel | público |
| `studio.seudominio.com` | painel Studio no Cloudflare Worker | interno, protegido por Cloudflare Access |
| `content-api.seudominio.com` | mesma aplicação Worker, rota `/api/public/*` | público, somente leitura |

O hostname público separado é deliberado. Se o Cloudflare Access for aplicado no mesmo hostname do Studio sem uma política de bypass cuidadosamente desenhada, ele também bloqueará o app público. Separar os hosts deixa a fronteira de segurança explícita e mais fácil de auditar.

### 5.2 Ambientes

| Ambiente | D1 e R2 | Supabase | Vercel | Finalidade |
|---|---|---|---|---|
| Local | emuladores Wrangler em `.wrangler/state` | projeto dev ou Supabase local | `localhost:3000` | desenvolvimento individual |
| Staging | `receita-da-hora-studio-staging` e bucket staging | projeto staging | Preview/branch de integração | validação de integração |
| Produção | `receita-da-hora-studio-prod` e bucket prod | projeto prod | domínio principal | usuários reais |

Não se deve usar o D1 de produção nas previews do Vercel. Esse erro permitiria que uma alteração em branch de teste exibisse conteúdo editorial real ou mascarasse problemas de contrato.

## 6. Fase 1 — Preparar Cloudflare para produção

### 6.1 Criar recursos

No diretório `studio/`:

```bash
npx wrangler login
npx wrangler d1 create receita-da-hora-studio-prod
npx wrangler r2 bucket create receita-da-hora-assets-prod
```

Ao criar o D1, guarde o `database_id` retornado. Atualize `studio/wrangler.jsonc`, no bloco `env.production`, com o ID e nomes reais. Não altere a configuração de desenvolvimento, que usa IDs locais e emuladores de propósito.

Depois aplique as migrations e publique:

```bash
npm run db:migrate:production
npm run deploy:production
```

Migrations são a forma correta de versionar e aplicar o schema D1; não use SQL manual no banco de produção sem uma migration versionada no repositório. Referência: [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

### 6.2 Configurar hostnames e Access

1. Associe `studio.seudominio.com` e `content-api.seudominio.com` ao Worker no Cloudflare.
2. No Zero Trust, crie uma aplicação Cloudflare Access para `studio.seudominio.com`.
3. Crie política de allow para o grupo/e-mails responsáveis pelo conteúdo.
4. Copie o domínio do time e o Audience (`AUD`) para `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD` no ambiente de produção.
5. Mantenha `ACCESS_BYPASS` como `false` em produção.
6. Não aplique Access a `content-api.seudominio.com`.

Os endpoints públicos já restringem dados a receitas e assets publicados/aprovados. Qualquer endpoint administrativo deve continuar exigindo o JWT do Access.

### 6.3 Segredos do Worker

Segredos, inclusive futuras chaves de IA, devem ser configurados assim:

```bash
npx wrangler secret put OPENAI_API_KEY --env production
```

Nunca devem ser colocados em `wrangler.jsonc`, em `.env` versionado, nem em variáveis expostas pelo Next.js. Referência: [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## 7. Fase 2 — Evoluir o contrato editorial do Studio

### 7.1 Nova migration de metadados para recomendação

Criar uma migration, por exemplo `studio/migrations/0003_recipe_recommendation_metadata.sql`, que adicione dados estruturados à receita. A modelagem pode usar colunas JSON com validação Zod no Worker, ou tabelas normalizadas; para o MVP, JSON estruturado é uma escolha aceitável e reduz a complexidade operacional.

Campos necessários:

```text
meal_types       JSON array: ["breakfast", "snack"]
dietary_tags     JSON array: ["vegetarian", "lactose-free"]
ingredients_tags JSON array normalizado: ["abacate", "ovo", "gluten"]
cuisine          TEXT
nutrition        JSON opcional: { calories, protein, carbs, fat }
traits           JSON: { comfort, lightness, protein, cost, novelty }
weather_affinity JSON: { hot, mild, cold, rainy }
palette          JSON: { background, accent, accentStrong, text, mutedText }
```

Restrições recomendadas:

- os números de `traits` e `weather_affinity` devem estar entre 0 e 100;
- `meal_types` só aceita os quatro valores usados pelo app;
- tags dietéticas devem usar o vocabulário do app (`vegetarian`, `vegan`, `lactose-free`, `gluten-free`);
- `ingredients_tags` deve ser calculado/normalizado a partir dos ingredientes associados, com possibilidade de complementar alérgenos; não deve depender apenas de texto livre;
- `palette` deve ter fallback editorial definido, nunca valor nulo no conteúdo publicado.

### 7.2 Fluxo de publicação revisado

Estender a validação de publicação existente para incluir:

1. dados editoriais básicos válidos;
2. imagem principal aprovada;
3. imagens de ingredientes exigidas aprovadas;
4. aprovação humana da receita;
5. metadados de recomendação presentes e válidos.

Essa regra impede que o app público receba uma receita impossível de classificar com segurança. Deve haver mensagem de bloqueio específica no Studio, por exemplo: “Defina tipos de refeição e tags dietéticas antes de publicar”.

### 7.3 Contrato da API pública

A API deve expor um DTO deliberado, não a linha bruta de D1. O contrato mínimo é:

```ts
type StudioPublicRecipe = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTimeMinutes: number;
  servings: number;
  cuisine: string;
  mealTypes: Array<"breakfast" | "lunch" | "snack" | "dinner">;
  dietaryTags: string[];
  ingredientsTags: string[];
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  traits: { comfort: number; lightness: number; protein: number; cost: number; novelty: number };
  weatherAffinity: { hot: number; mild: number; cold: number; rainy: number };
  palette: { background: string; backgroundSecondary?: string; accent: string; accentStrong: string; text: string; mutedText: string };
  ingredients: Array<{ item: string; quantity: number | null; unit: string; note?: string; imageUrl?: string | null }>;
  steps: Array<{ number: number; instruction: string }>;
  publishedAt: string;
};
```

Preferir nomes do contrato do app (`title`, `prepTimeMinutes`, `imageUrl`) reduz adapters frágeis. Caso a API preserve os nomes atuais em `snake_case`, o adapter do Next.js deve converter e validar todos os campos em um único local.

### 7.4 Cache e invalidação

Inicialmente, usar `Cache-Control: public, max-age=60` como já ocorre na API e revalidação de até 60 segundos no Next.js. O atraso editorial máximo de um minuto é aceitável no MVP e é muito mais simples que webhooks.

Depois que o fluxo estiver estável, um webhook assinado do Studio para uma Route Handler no Vercel pode disparar revalidação imediata de tags/rotas após publicar ou despublicar. Este webhook deve ter assinatura compartilhada, proteção contra replay e logs; não é necessário para a primeira entrega.

## 8. Fase 3 — Integrar o Next.js ao catálogo do Studio

### 8.1 Criar uma fronteira de dados

Criar `src/services/studio-content.ts` com as seguintes responsabilidades:

1. Ler `STUDIO_PUBLIC_API_URL` no servidor.
2. Buscar `GET /api/public/recipes` e detalhes quando necessário.
3. Validar toda resposta com Zod.
4. Converter o DTO público para o tipo `Recipe` interno.
5. Resolver URLs relativas de asset para URLs absolutas.
6. Definir tempo de cache/revalidação.
7. Emitir erro observável quando o contrato for inválido ou a API estiver indisponível.

O restante da aplicação não deve conhecer URLs, JSON remoto ou particularidades do Worker. Essa fronteira permite alterar Cloudflare, cache ou schema sem reescrever componentes e evita que respostas externas não validadas cheguem ao algoritmo de recomendação.

### 8.2 Substituir imports diretos de forma gradual

Hoje há imports diretos de `src/data/recipes.ts` em `Home`, `Onboarding` e `SavedRecipes`. A migração proposta é:

1. Fazer o catálogo ser carregado pela página/servidor e fornecido via props ou provider.
2. Fazer os componentes usarem a mesma fonte injetada.
3. Manter `RECIPES` estático como fallback apenas temporário.
4. Executar testes do recomendador com fixtures provenientes do contrato Studio.
5. Remover o fallback de produção somente após validação em staging.

Não é recomendado consultar o Worker diretamente em cada componente cliente. Isso aumenta latência, duplica chamadas, dificulta tratamento de erro e torna o contrato externo parte da interface de UI.

### 8.3 Estratégia de falha

Durante a migração, se a API do Studio estiver indisponível:

- em desenvolvimento e staging, exibir erro claro para corrigir integração;
- em produção, usar o último catálogo cacheado quando possível;
- durante a fase de transição, usar o catálogo estático de contingência;
- nunca inventar metadados dietéticos ou de alérgenos ausentes.

Após a migração estar madura, o fallback estático deve ser removido para não esconder falhas editoriais ou manter conteúdo desatualizado indefinidamente.

## 9. Fase 4 — Supabase: autenticação e dados privados

### 9.1 Criar projetos separados

Criar projetos Supabase distintos para staging e produção. A região deve considerar proximidade com usuários e requisitos de dados; para operação europeia, uma região da UE é a escolha natural.

### 9.2 Corrigir o escopo do schema atual

O arquivo `supabase/schema.sql` atual cria tabelas `recipes`, `recipe_ingredients` e `recipe_steps`. Isso conflita com a decisão de que Studio/D1 é a fonte editorial.

Antes de executar o schema, separar uma migration de dados privados contendo apenas:

- `profiles`;
- `saved_recipes`;
- `recipe_feedback`;
- `recommendation_events`;
- índices;
- RLS e políticas relacionadas.

As tabelas privadas devem guardar `recipe_id` como `text`, referente ao ID estável da receita no Studio. Não criar uma chave estrangeira local para uma cópia de receitas.

### 9.3 RLS obrigatória

As tabelas privadas precisam de RLS ativada e políticas com `auth.uid()`:

- usuário só lê/altera seu `profile`;
- usuário só lê/altera seus salvos;
- usuário só lê/altera seus feedbacks;
- usuário só lê e insere seus eventos;
- nenhum usuário pode editar metadados editoriais por meio do Supabase.

Evitar uma chave `service_role` no cliente. Caso uma operação administrativa seja necessária no futuro, ela deve rodar exclusivamente no servidor, com autorização explícita.

### 9.4 Integrar Auth ao Next.js

Adicionar os pacotes atuais para integração SSR/cookies do Supabase e implementar:

```text
src/lib/supabase/browser.ts     cliente de navegador
src/lib/supabase/server.ts      cliente por request/cookies
src/app/auth/callback/route.ts  troca do code OAuth por sessão
src/app/auth/reset-password/    tela de atualização de senha
middleware.ts                   atualização segura de sessão, se necessária
```

O fluxo de persistência deve identificar usuários autenticados pelo UUID de `auth.users`. Usuários anônimos podem continuar em modo local-first; após login, é necessário definir e testar uma estratégia de migração/mesclagem de dados locais para a conta, sem sobrescrever dados existentes silenciosamente.

## 10. Fase 5 — E-mail, senha e OAuth com Supabase + Resend

### 10.1 E-mail e senha

No Supabase Auth:

1. Habilitar Email + Password.
2. Habilitar confirmação de e-mail.
3. Definir política de senha apropriada.
4. Configurar `Site URL` como `https://app.seudominio.com`.
5. Adicionar Redirect URLs:

```text
http://localhost:3000/**
https://app.seudominio.com/**
https://*-seu-time.vercel.app/**
```

A URL de redirect é parte da segurança da autenticação: ela impede que links de confirmação ou recuperação enviem sessões para domínios não autorizados. Referência: [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

### 10.2 Configurar Resend como SMTP do Supabase

Os e-mails de confirmação e recuperação devem ser enviados pelo **Supabase Auth usando SMTP do Resend**. Não há necessidade de chamar o SDK do Resend no app para esses fluxos.

1. Criar conta no Resend.
2. Adicionar e verificar o domínio de envio, por exemplo `email.seudominio.com`.
3. Publicar os registros DNS exigidos (SPF/DKIM e demais instruções do painel).
4. Criar uma API key dedicada a SMTP/Auth.
5. Em Supabase → Authentication → SMTP, preencher:

```text
Host: smtp.resend.com
Porta: 465
Usuário: resend
Senha: <API_KEY_DO_RESEND>
Remetente: Receita da Hora <contato@email.seudominio.com>
```

6. Personalizar os templates **Confirm sign up** e **Reset password** em português.
7. Desativar rastreamento de links no provedor para e-mails de Auth, pois links reescritos podem invalidar o fluxo de confirmação.
8. Testar cadastro, reenvio de confirmação, reset de senha e alteração de senha.

O SMTP padrão do Supabase possui restrições e não é apropriado para entrega de produção a todos os usuários. Referências: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [SMTP do Resend](https://resend.com/changelog/smtp-service), [templates de autenticação](https://supabase.com/docs/guides/auth/auth-email-templates).

### 10.3 OAuth com Google

1. Criar OAuth Client do tipo **Web application** no Google Cloud Console.
2. Em Authorized JavaScript origins, adicionar `http://localhost:3000` e `https://app.seudominio.com`.
3. Em Authorized redirect URIs, usar exatamente:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

4. Em Supabase → Authentication → Providers → Google, informar Client ID e Client Secret.
5. No app, iniciar com `signInWithOAuth({ provider: "google", options: { redirectTo } })`.
6. Implementar a rota `/auth/callback` que recebe o `code`, executa `exchangeCodeForSession` e redireciona para rota interna segura.

O callback OAuth registrado no Google é o endpoint do Supabase; o Supabase retorna o usuário para uma URL permitida do app. Referência: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google?environment=server&platform=web&queryGroups=environment&queryGroups=platform).

## 11. Fase 6 — Vercel e variáveis de ambiente

### 11.1 Projeto Vercel

1. Conectar o repositório Git ao Vercel.
2. Criar o projeto com Root Directory `.`; o Next.js está na raiz e `studio/` não deve ser configurado como projeto Vercel.
3. Usar o preset Next.js detectado pelo Vercel.
4. Configurar variáveis para Development, Preview e Production.
5. Associar `app.seudominio.com` ao projeto de produção.
6. Depois de salvar/alterar variáveis, fazer novo deployment; alterações não atualizam deployments antigos.

Em repositórios com mais de um app, o Root Directory precisa ser configurado explicitamente por projeto. Referência: [Vercel monorepos](https://vercel.com/docs/monorepos).

### 11.2 Variáveis do app público

Arquivo local não versionado `.env.local`:

```bash
NEXT_PUBLIC_STUDIO_API_URL=http://localhost:8788
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<chave>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Configuração equivalente no Vercel:

| Variável | Development | Preview | Production | Exposição |
|---|---|---|---|---|
| `NEXT_PUBLIC_STUDIO_API_URL` | `http://localhost:8788` | API de staging | `https://content-api.seudominio.com` | pública |
| `NEXT_PUBLIC_SUPABASE_URL` | projeto dev | projeto staging | projeto prod | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável dev | chave publicável staging | chave publicável prod | pública |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | URL do preview | `https://app.seudominio.com` | pública |

Variáveis que **não** pertencem ao Vercel neste fluxo básico:

| Segredo | Onde deve ficar | Motivo |
|---|---|---|
| `RESEND_API_KEY` usada como SMTP | painel SMTP do Supabase | o Supabase envia os e-mails de Auth |
| `CF_ACCESS_AUD` e domínio Access | ambiente/configuração do Worker | pertencem à proteção administrativa do Studio |
| chaves de IA | Cloudflare Workers secrets | apenas o Worker pode usá-las |
| `SUPABASE_SERVICE_ROLE_KEY` | nenhum cliente; servidor apenas se um caso futuro justificar | ignora RLS e não pode ser exposta |

Qualquer variável com `NEXT_PUBLIC_` é incorporada ao bundle do navegador. Isso é apropriado para URL e chave publicável do Supabase, mas nunca para uma chave de serviço ou segredo de e-mail. Referência: [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 12. Ordem de implementação recomendada

### Marco A — Contrato e infraestrutura

1. Criar D1/R2 de staging e produção.
2. Configurar Worker, hosts separados e Cloudflare Access.
3. Criar migration dos metadados de recomendação.
4. Atualizar formulários e validação de publicação no Studio.
5. Versionar e testar o novo contrato público.

**Saída esperada:** uma receita publicada no Studio pode ser buscada pelo endpoint público com todos os dados necessários ao tipo `Recipe`.

### Marco B — Catálogo no app

1. Criar adapter validado no Next.js.
2. Injetar catálogo nos componentes, removendo imports diretos da fonte estática.
3. Configurar cache e fallback temporário.
4. Testar recomendação, filtros alimentares, favoritos e páginas de detalhe com receitas do Studio.

**Saída esperada:** publicar/despublicar no Studio atualiza o catálogo público sem novo deploy do Vercel.

### Marco C — Identidade e persistência

1. Criar Supabase staging/prod.
2. Aplicar somente schema privado e RLS.
3. Implementar e-mail/senha, sessão SSR e rotas de callback/reset.
4. Configurar Resend SMTP e templates.
5. Implementar Google OAuth.
6. Migrar salvos, perfil, feedback e eventos para Supabase para usuários autenticados.

**Saída esperada:** usuários autenticados mantêm seus dados entre dispositivos e não acessam os dados de terceiros.

### Marco D — Operação e endurecimento

1. Criar dashboards/logs para erros de API, autenticação e e-mail.
2. Configurar alertas de falha de deploy e disponibilidade do Worker.
3. Adicionar revalidação por webhook assinado, se a janela de cache for inadequada.
4. Remover fallback estático de produção após período de estabilidade.
5. Documentar rotação de segredos e procedimento de rollback.

## 13. Plano de testes e critérios de aceite

### Conteúdo

- [ ] Receita em `draft`, `review`, `approved` ou `rejected` não aparece na API pública.
- [ ] Receita `published` aparece na lista e no detalhe público.
- [ ] Despublicar remove a receita do app dentro da janela de cache definida.
- [ ] Asset não aprovado não é entregue pela rota pública.
- [ ] Tentar publicar sem metadados de recomendação retorna bloqueios compreensíveis.
- [ ] O DTO público passa pela validação Zod no Next.js.

### Recomendação

- [ ] Preferências vegetarianas, veganas, sem lactose e sem glúten filtram receitas corretamente.
- [ ] Alergias e ingredientes excluídos nunca aparecem em sugestões.
- [ ] Horário, clima, tempo disponível, objetivos e diversidade continuam afetando o ranking.
- [ ] IDs de receita permanecem estáveis para preservar favoritos e histórico.

### Autenticação e dados privados

- [ ] Cadastro por e-mail envia confirmação via domínio Resend verificado.
- [ ] Link de confirmação retorna para uma URL permitida.
- [ ] Recuperação de senha funciona e e-mail não vaza se o endereço existe ou não.
- [ ] Login Google cria/recupera a mesma conta corretamente.
- [ ] Usuário A não consegue consultar/modificar registros privados do usuário B, inclusive via API direta do Supabase.
- [ ] Logout limpa a sessão e não apaga dados remotos.

### Segurança e operação

- [ ] Rotas administrativas do Studio retornam 401/403 sem Cloudflare Access.
- [ ] A API pública não retorna status internos, lote, dados de revisão ou URLs administrativas.
- [ ] Nenhum segredo aparece no bundle, no Git ou nos logs.
- [ ] Preview usa Supabase/Studio de staging, nunca produção.
- [ ] Deploy do Vercel conclui `npm run check` e `npm run build`.

## 14. Riscos, decisões pendentes e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Studio não inclui metadados do algoritmo | recomendações incorretas ou inseguras | tornar campos obrigatórios antes da publicação |
| Duplicar receitas no Supabase | conflito de dados e manutenção dupla | Supabase armazena somente referências por `recipe_id` |
| Access bloqueia API pública | app não carrega receitas em produção | hosts separados e Access só no host administrativo |
| Preview aponta para produção | vazamento ou publicação acidental | recursos de staging separados e variáveis por ambiente |
| Uso de `service_role` no cliente | acesso total ao banco | proibir a chave no frontend e manter RLS ativa |
| Link de Auth reescrito por rastreamento | confirmação/reset falha | desativar tracking para e-mails de autenticação |
| Cache excessivo | publicação demora a aparecer | revalidação curta inicialmente; webhook assinado depois |
| IDs mudam na migração | favoritos/histórico quebram | adotar o `recipes.id` estável do Studio como ID público |

## 15. Perguntas para revisão do Claude Code

Use esta lista como checklist de revisão técnica e de propostas de melhoria:

1. A modelagem de metadados no Studio deveria usar JSON validado ou tabelas normalizadas para tags, afinidades e atributos? Justifique pelo volume e pelos filtros previstos.
2. O contrato público deve ser uma versão nova (`/api/public/v1`) desde já para permitir evolução sem quebra?
3. Qual padrão de cache/revalidação do Next.js é compatível com a versão instalada e atende a publicação em até um minuto?
4. Quais componentes devem ser server components, client components ou receber dados por provider para evitar waterfalls?
5. Como migrar dados do `localStorage` ao primeiro login sem criar duplicatas de salvos, feedbacks e eventos?
6. Há alguma política RLS ausente para `profiles`, `saved_recipes`, `recipe_feedback` e `recommendation_events`?
7. O schema Supabase atual deve ser dividido em migrations novas ou substituído antes de ser aplicado em qualquer ambiente?
8. O Studio precisa expor ETag, `Last-Modified` ou endpoint de webhook para revalidação eficiente?
9. O contrato de ingredientes deve distinguir ingrediente ausente, quantidade desconhecida e “a gosto” sem quebrar o tipo `Recipe`?
10. Quais testes end-to-end devem ser automatizados para validar publicação Studio → Worker → Vercel → recomendação?

## 16. Definição de pronto

A integração estará pronta quando a equipe puder criar, revisar e publicar uma receita no Studio e, sem editar o código do app ou fazer novo deploy, vê-la no Receita da Hora como uma candidata válida ao recomendador. Ao mesmo tempo, uma pessoa deverá poder criar conta, confirmar o e-mail, recuperar a senha, entrar por Google e reencontrar seu perfil, favoritos e feedbacks em outro dispositivo — com dados privados protegidos por RLS e conteúdo administrativo protegido pelo Cloudflare Access.
