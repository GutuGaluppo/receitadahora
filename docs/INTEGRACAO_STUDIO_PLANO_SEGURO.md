# Plano seguro de execução — Studio → Receita da Hora

**Papel deste documento:** complemento executável para [INTEGRACAO_STUDIO_MELHORIAS.md](./INTEGRACAO_STUDIO_MELHORIAS.md) e [INTEGRACAO_STUDIO_RECEITA_DA_HORA.md](./INTEGRACAO_STUDIO_RECEITA_DA_HORA.md).  
**Status:** decisões técnicas propostas para aprovação antes de implementação.  
**Última atualização:** 8 de outubro de 2026.

## 1. Por que este complemento existe

O documento de integração original define corretamente a visão: Studio é a fonte de conteúdo, Supabase guarda dados privados e o app público roda no Vercel. O documento de melhorias demonstrou que essa visão, sozinha, não é suficiente para uma implementação segura: existem incompatibilidades de contrato, ID, cache, ambientes e superfície pública.

Este documento elimina a ambiguidade entre os dois textos. Ele não reavalia alternativas abstratas; define uma sequência de decisões e entregas que impede regressões nos pontos críticos:

1. uma receita incompatível com o recomendador não pode ser publicada;
2. alergias e restrições não podem ser filtradas com dados incompletos;
3. dados locais e favoritos existentes não podem desaparecer durante a migração;
4. previews não podem tocar produção;
5. despublicação urgente deve propagar-se de forma confiável;
6. conteúdo público não pode ampliar desnecessariamente a exposição do painel interno;
7. contas e e-mails devem ser implementados com isolamento, limites e rastreabilidade.

## 2. Hierarquia dos documentos

| Documento | Uso | Autoridade |
|---|---|---|
| `INTEGRACAO_STUDIO_RECEITA_DA_HORA.md` | visão de produto, integrações e inventário de infraestrutura | contexto e objetivo |
| `INTEGRACAO_STUDIO_MELHORIAS.md` | análise de inconsistências, riscos e correções necessárias | requisitos de segurança e correção |
| **este documento** | decisões, ordem de execução, definição de pronto por entrega | plano operacional |

Em caso de conflito, prevalece a seguinte ordem: segurança/correção do documento de melhorias → decisão explícita deste plano → visão do documento original.

## 3. Decisões fechadas

### Registro de decisões do responsável

| ID | Decisão registrada | Efeito no plano |
|---|---|---|
| D-1 | Uma receita não pode ser publicada sem foto. A imagem é requisito central de UI/UX. | Asset principal aprovado passa a ser bloqueio absoluto de publicação e gate de release. |
| D-2 | Incluir os alérgenos amplamente conhecidos no contrato `contracts/catalog.ts` e permitir a seleção/inclusão pela interface do Studio. | O catálogo terá taxonomia fechada, seleção editorial auditável e validação de publicação. |
| D-3 | Correto. | Mantém-se a decisão correspondente já definida neste plano, sem alteração adicional. |
| D-4 | Confirmar novamente antes de produção. | Vira bloqueio explícito de release de produção; não é autorização prévia para publicar. |
| D-5 | Ok. | Mantém-se a decisão correspondente já definida neste plano. |
| D-6 | Confirmar novamente antes de produção. | Vira bloqueio explícito de release de produção; não é autorização prévia para publicar. |
| D-7 | Ok. | Mantém-se a decisão correspondente já definida neste plano. |
| D-8 | Responsável final: proprietário do projeto. | A aprovação final de produção, incidentes e rotação de segredos fica atribuída ao responsável do projeto. |

> **Nota operacional:** D-4 e D-6 devem constar no checklist manual de release. Este documento não substitui uma confirmação humana no momento do deploy de produção nem envia lembretes automaticamente.

### D1. Fonte de verdade e propriedade dos dados

- **Studio/D1/R2** é a única fonte de receitas, ingredientes, imagens e estado de publicação.
- **Supabase** não terá cópia de receitas, ingredientes ou passos. Ele manterá apenas referências textuais por `recipe_id` e dados privados do usuário.
- **Vercel/Next.js** não acessará D1 ou R2 diretamente; consumirá a API pública versionada do Studio no servidor.
- **Resend** será somente o SMTP transacional do Supabase Auth para confirmação, recuperação e notificações de segurança.

Isso evita a duplicação de regras de publicação e garante que a mesma transição editorial determine o que pode aparecer no produto público.

### D2. API de catálogo versionada e completa

Criar a rota:

```text
GET /api/public/v1/catalog
```

Resposta:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-08T10:00:00.000Z",
  "recipes": []
}
```

Cada item de `recipes` deve conter todos os campos exigidos para montar o tipo `Recipe` do app em uma única chamada: dados editoriais, ingredientes, passos, metadados de recomendação, URL de imagem e `publishedAt`.

As rotas `/api/public/recipes` e `/api/public/recipes/:slug` permanecem por compatibilidade, mas o app público passa a usar exclusivamente o catálogo v1. O endpoint deve retornar `ETag` e `Last-Modified`; clientes podem fazer requisições condicionais.

### D3. Metadados críticos bloqueiam a publicação

Criar migration no Studio para armazenar:

- `legacy_ids` — IDs legados do catálogo atual;
- `meal_types`;
- `dietary_tags`;
- `allergens` e data/autor de revisão;
- `ingredients_tags` normalizados;
- `cuisine`;
- `traits`;
- `weather_affinity`;
- `palette_key`;
- `nutrition`, quando disponível;
- `featured`, caso o produto precise de receita editorialmente destacada.

Regras obrigatórias:

- uma receita sem imagem principal aprovada não pode ser publicada; o `hero_asset_id` deve existir, apontar para um asset não excluído e com status `approved`;
- `allergens = null` significa **não revisado** e bloqueia a publicação;
- `allergens = []` significa “revisado, nenhum alérgeno declarado”;
- dados sugeridos por automação/IA ficam em estado `suggested` e não satisfazem a validação até revisão humana;
- `ingredients_tags` e alérgenos devem ser derivados dos ingredientes globais normalizados e apenas complementados por revisão, nunca inferidos apenas de texto livre;
- `traits` e afinidades climáticas aceitam somente valores entre 0 e 100;
- `meal_types` e `dietary_tags` usam vocabulário fechado, igual ao tipo usado no app;
- a paleta é uma chave de preset existente, não cores hex arbitrárias.

### D3.1 Taxonomia de alérgenos no contrato e no Studio

Criar `contracts/catalog.ts` como contrato compartilhado por Studio e app público. Ele deve exportar IDs estáveis, rótulos em português e validação Zod para os principais alérgenos usados pelo produto:

```ts
export const KNOWN_ALLERGENS = [
  "gluten_cereals", // trigo, centeio, cevada, aveia e híbridos
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "almond",
  "hazelnut",
  "cashew",
  "brazil_nut",
  "macadamia",
  "walnut",
  "pecan",
  "pistachio",
  "pine_nut",
  "chestnut",
  "natural_latex",
] as const;
```

Esta base segue os grupos principais adotados pela Anvisa para rotulagem de alergênicos. A regulamentação também deixa claro que há mais de 170 alimentos capazes de causar alergias; portanto, a taxonomia fechada cobre os riscos mais conhecidos, mas não autoriza o sistema a tratar itens fora dela como seguros. [Esclarecimentos da Anvisa sobre a RDC 727/2022](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/alimentos/perguntas-e-respostas-arquivos/rotulagem-de-alergenicos.pdf/%40%40download/file)

A interface do Studio deve permitir:

1. selecionar múltiplos itens da lista canônica;
2. incluir um alérgeno adicional pelo nome quando necessário;
3. marcar a origem de cada marcação como `derived` (derivado de ingrediente), `manual` (incluído por editor) ou `suggested` (automação/IA);
4. exigir justificativa curta para inclusão manual e confirmação humana para qualquer item `suggested`;
5. gravar autor e data da revisão;
6. diferenciar explicitamente “nenhum conhecido” de “não revisado”.

O contrato pode representar inclusões fora da lista canônica separadamente, evitando que texto livre seja usado como ID do algoritmo:

```ts
type AllergenDeclaration = {
  known: readonly KnownAllergen[];
  additional: readonly { normalizedName: string; displayName: string; source: "derived" | "manual"; reviewedAt: string }[];
  reviewedAt: string | null;
};
```

`reviewedAt: null` bloqueia publicação. A UI do app deve informar a presença declarada, mas não prometer ausência de contaminação cruzada; isso exigiria dados de fabricação que receitas domésticas/editoriais normalmente não possuem.

### D4. Identidade estável e migração do catálogo atual

Antes de tornar o Studio fonte do catálogo público:

1. importar as receitas atuais de `src/data/recipes.ts` para o Studio;
2. guardar o ID atual como `legacy_id`/`legacy_ids` da receita importada;
3. publicar apenas receitas importadas que passarem pela validação editorial e de segurança;
4. expor os IDs legados no catálogo temporariamente;
5. traduzir IDs presentes no `localStorage` para os novos IDs do Studio antes de sincronizar com Supabase;
6. tornar a migração idempotente: executar duas vezes deve resultar no mesmo estado, sem duplicatas.

Não adotar automaticamente `recipe_…` como substituto de IDs existentes sem esse mapa. Hoje favoritos, feedback e eventos se apoiam nos IDs legíveis do catálogo estático.

### D5. Busca somente no servidor e variável privada

Usar a variável:

```bash
STUDIO_PUBLIC_API_URL=https://content-api.seudominio.com
```

Sem `NEXT_PUBLIC_`. O catálogo deve ser buscado pelo Server Component/serviço do Next.js e distribuído para componentes clientes por um `CatalogProvider`.

Motivos:

- evita congelar a URL no bundle de build;
- não expõe detalhes de infraestrutura à UI;
- elimina waterfalls e chamadas repetidas pelo navegador;
- centraliza validação Zod, cache, telemetria e fallback.

As únicas variáveis publicáveis necessárias são as do cliente Supabase e a URL pública do site.

### D6. Cache com invalidação ativa

O TTL é somente uma rede de segurança. A publicação e despublicação devem chamar revalidação ativa.

Fluxo:

```text
publicar/despublicar no Studio
  → Worker envia POST assinado para app.seudominio.com/api/revalidate
  → Route Handler valida HMAC, timestamp e nonce
  → revalidateTag("catalog", { expire: 0 })
  → próxima visita busca catálogo novo
```

Requisitos do webhook:

- HMAC-SHA256 sobre timestamp e corpo;
- janela máxima de cinco minutos;
- armazenamento/rejeição de nonce para impedir replay;
- segredo em Cloudflare Workers secrets e em variável privada no Vercel;
- log estruturado de sucesso, falha e latência;
- TTL de alguns minutos para recuperação caso o webhook falhe.

Uma despublicação por risco alimentar não pode depender exclusivamente de cache com stale-while-revalidate.

### D7. Host público minimizado

Usar hosts distintos:

```text
studio.seudominio.com       painel e APIs administrativas; Cloudflare Access obrigatório
content-api.seudominio.com  somente /api/public/v1/catalog e assets públicos
app.seudominio.com          app Next.js no Vercel
```

No host `content-api`, qualquer caminho que não seja `/api/public/*` deve retornar 404. Não servir o SPA do Studio, nem expor rotas administrativas protegidas nesse host. Desabilitar URLs alternativas `workers.dev` e preview para ambientes onde o Access é exigido, quando compatível com a configuração escolhida.

### D8. Ambientes físicos separados

Adotar nomes e configuração coerentes:

```text
receita-da-hora-studio-staging      D1 staging
receita-da-hora-studio-prod         D1 produção
receita-da-hora-assets-staging      R2 staging
receita-da-hora-assets-prod         R2 produção
```

Criar `env.staging` em `studio/wrangler.jsonc`, com seus próprios IDs, bucket, domínio Access e `ACCESS_BYPASS=false`. Criar scripts explícitos:

```text
db:migrate:staging
deploy:staging
db:migrate:production
deploy:production
```

O Vercel Preview aponta para Studio staging e Supabase staging. Produção aponta exclusivamente para recursos de produção.

### D9. Supabase é exclusivo para identidade e estado privado

Substituir o schema alvo atual antes de seu primeiro apply por migrations em `supabase/migrations/` que incluam somente:

- `profiles`;
- `saved_recipes`;
- `recipe_feedback`;
- `recommendation_events`;
- índices, triggers, RLS e retenção.

Regras adicionais:

- `recipe_id` é `text not null`, sem foreign key para uma tabela editorial local;
- trigger ou `upsert` cria `profiles` ao primeiro login;
- eventos têm política de `delete` pelo próprio usuário;
- inserções de importação usam IDs do cliente e `upsert`/conflitos idempotentes;
- definir retenção para eventos de alto volume, como `recipe_shown`;
- `onboarded` possui uma única fonte de verdade no perfil remoto após login.

### D10. Auth, Resend, OAuth e privacidade

- Email/senha, confirmação de e-mail e reset de senha: Supabase Auth.
- E-mails: Resend configurado como SMTP do Supabase; a API key SMTP não vai para Vercel.
- Google OAuth: callback exato do Supabase, com troca de code em `/auth/callback`.
- Next.js 16: usar `proxy.ts` apenas se necessário para atualização de sessão; não usar Proxy como camada principal de autorização.
- Produção Supabase aceita apenas o domínio final como redirect; previews pertencem ao Supabase staging.
- Adicionar CAPTCHA/Turnstile para cadastro e recuperação de senha, rate limits de Auth e SPF/DKIM/DMARC no domínio de envio.
- Criar interface de exportação e exclusão de conta, política de privacidade e retenção de eventos antes do lançamento público.

## 4. Backlog ordenado por bloqueio

| Ordem | Entrega | Bloqueia | Resultado verificável |
|---:|---|---|---|
| 0 | Padronizar recursos e criar staging | todos os deploys | `wrangler.jsonc` possui `staging` e `production` sem IDs trocados |
| 1 | Importar catálogo estático e preservar IDs legados | favoritos, onboarding e migração | todo ID antigo possui resolução documentada |
| 2 | Migration de metadados e bloqueios de publicação | catálogo público seguro | receita com alérgeno não revisado não publica |
| 3 | Endpoint `/api/public/v1/catalog` + schema compartilhado | adapter do app | uma chamada retorna catálogo completo e validado |
| 4 | Adapter server-side + `CatalogProvider` | uso do Studio pelo app | nenhum componente importa catálogo estático diretamente |
| 5 | Webhook assinado + snapshot de contingência | atualização/rollback confiáveis | publicar/despublicar reflete sem deploy e falha controlada |
| 6 | Supabase staging + migrations privadas/RLS | contas persistentes | usuário não acessa registros de outro usuário |
| 7 | Auth, Resend e OAuth | onboarding de contas | confirmação, reset e Google login testados |
| 8 | Migração idempotente do `localStorage` | preservação de histórico | repetir importação não duplica registros |
| 9 | LGPD, rate limit e observabilidade | lançamento público | exclusão/exportação, alertas e limites ativos |
| 10 | Produção e remoção do fallback manual | encerramento da transição | Studio é única fonte editorial em produção |

## 5. Critérios de gate

Nenhuma entrega avança de fase sem o gate anterior.

### Gate A — Contrato editorial

- [ ] Receita sem imagem principal aprovada não publica.
- [ ] Todas as receitas expostas têm ingredientes, passos e metadados exigidos pelo `Recipe`.
- [ ] `allergens = null` bloqueia publicação.
- [ ] `contracts/catalog.ts` valida IDs canônicos e inclusões adicionais revisadas.
- [ ] Uma lista de alérgenos de teste exclui exatamente as receitas esperadas no recomendador.
- [ ] O contrato possui `schemaVersion`, fixture e teste Zod no Worker e no app.

### Gate B — Compatibilidade e catálogo no app

- [ ] IDs legados são traduzidos antes do uso de salvos, feedbacks e eventos.
- [ ] Onboarding não depende de um ID estático inexistente no Studio.
- [ ] Quantidade `null`/“a gosto” não aparece como `0 g` na interface.
- [ ] Receita despublicada possui comportamento de UX explícito para favoritos existentes.
- [ ] App indisponível do Studio usa último snapshot válido e registra erro.

### Gate C — Segurança de infraestrutura

- [ ] `content-api` não serve SPA, dashboard nem APIs administrativas.
- [ ] `studio` exige Cloudflare Access para toda rota administrativa.
- [ ] Staging e produção usam D1, R2, Supabase e domínios distintos.
- [ ] Nenhuma variável secreta está em `NEXT_PUBLIC_*`, Git ou logs.
- [ ] Publicar e despublicar acionam webhook válido; assinatura inválida e replay são rejeitados.

### Gate D — Contas e privacidade

- [ ] RLS é testada com dois usuários e bloqueia qualquer acesso cruzado.
- [ ] Confirmação e reset chegam por domínio Resend com SPF, DKIM e DMARC válidos.
- [ ] Projeto Supabase de produção não aceita redirects `*.vercel.app`.
- [ ] Captcha e rate limit estão ativos nos fluxos de e-mail.
- [ ] Exclusão de conta remove dados privados e exportação entrega os dados esperados.

## 6. Variáveis de ambiente finais

### App público no Vercel

```bash
# Somente servidor
STUDIO_PUBLIC_API_URL=https://content-api.seudominio.com
STUDIO_REVALIDATE_SECRET=<segredo-HMAC>

# Publicáveis no navegador
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<chave>
NEXT_PUBLIC_SITE_URL=https://app.seudominio.com
```

### Worker do Studio no Cloudflare

```text
ENVIRONMENT=staging|production
ACCESS_BYPASS=false
CF_ACCESS_TEAM_DOMAIN=<time>.cloudflareaccess.com
CF_ACCESS_AUD=<aud-do-studio>
APP_REVALIDATE_URL=https://app.seudominio.com/api/revalidate
APP_REVALIDATE_SECRET=<mesmo segredo HMAC, configurado como secret>
```

As chaves `APP_REVALIDATE_SECRET`, OpenAI e quaisquer tokens de terceiros devem ser Workers secrets. A chave de SMTP do Resend deve ficar no painel do Supabase, não no Vercel.

## 7. Estratégia de rollback

| Falha | Resposta imediata | Recuperação |
|---|---|---|
| Catálogo Studio incompatível | adapter recusa pelo Zod/schemaVersion e usa snapshot válido | corrigir contrato; publicar Worker compatível |
| Webhook falha | TTL atualiza eventualmente; alerta é aberto | reenviar evento autenticado ou invalidar tag manualmente |
| Receita com metadado inseguro publicada | despublicar no Studio e enviar invalidação imediata | corrigir, revisar alérgenos e republicar |
| Supabase/Auth indisponível | modo anônimo/local preserva navegação de catálogo | não perder dados locais; restaurar serviço e retentar sincronização |
| Deploy de app falha | manter último deployment Vercel | corrigir em staging e promover apenas build validado |

O snapshot é contingência operacional, não uma segunda fonte editorial. Ele é gerado a partir do catálogo validado e contém `generatedAt` para tornar a defasagem observável.

## 8. Revisão final antes de iniciar código

Antes do primeiro código, a equipe deve confirmar explicitamente:

1. domínios definitivos e proprietário do DNS;
2. contas Cloudflare, Vercel, Supabase, Resend e Google Cloud com responsáveis e acesso de recuperação;
3. região, retenção e política de privacidade aplicáveis;
4. taxonomia de alérgenos e dietas em português;
5. rubrica editorial de `traits` e afinidade climática;
6. decisão de UX para receita salva despublicada;
7. política de rollout: staging, beta controlada, produção;
8. responsáveis por aprovação editorial, resposta a incidente e rotação de segredos.

### Confirmação obrigatória imediatamente antes de produção

Além dos itens anteriores, o release manager deve obter confirmação explícita do responsável do projeto para D-4 e D-6. Sem essas duas confirmações, o deploy pode ocorrer apenas em staging/preview, nunca em produção.

Sem essas decisões, é possível escrever código, mas não concluir uma integração segura e operável.
