# RECEITA DA HORA — STUDIO / ADMIN DASHBOARD

Desenvolva uma aplicação interna chamada **Receita da Hora Studio**.

O Studio será o painel operacional utilizado pela equipe de desenvolvimento/conteúdo para gerenciar:

- receitas;
- imagens principais das receitas;
- biblioteca de ingredientes;
- imagens dos ingredientes;
- lotes diários de geração;
- revisão;
- aprovação;
- publicação;
- identificação de duplicidades;
- cobertura de assets.

O Studio **não é um produto público** e não deve parecer um CMS corporativo complexo.

A prioridade absoluta é:

> simplicidade, clareza operacional e velocidade.

---

# 1. Objetivo

O Receita da Hora Studio deve funcionar como a linha de produção de conteúdo do aplicativo Receita da Hora.

Fluxo principal:

```text
Gerar lote
↓
Criar receitas
↓
Detectar duplicidades
↓
Identificar ingredientes
↓
Verificar quais assets já existem
↓
Gerar apenas assets ausentes
↓
Revisar receita
↓
Revisar imagem
↓
Aprovar
↓
Publicar
```

Regra fundamental:

> Nunca gerar novamente um asset de ingrediente antes de consultar a biblioteca existente.

---

# 2. Stack

Priorizar uma arquitetura simples, moderna e fortemente integrada à Cloudflare.

## Frontend

Preferência:

- React
- TypeScript
- Next.js ou framework React compatível com Cloudflare
- Tailwind CSS
- componentes acessíveis e reutilizáveis

Evitar dependências desnecessárias.

---

# 3. Infraestrutura Cloudflare

## Cloudflare D1

Usar como banco principal de metadados.

Armazenar:

- receitas;
- ingredientes;
- relacionamento receita ↔ ingrediente;
- lotes;
- status;
- versões;
- referências de assets;
- datas;
- informações de aprovação.

As alterações de schema devem utilizar migrations versionadas.

---

## Cloudflare R2

Será a biblioteca central de assets do Receita da Hora.

Armazenar:

- imagens principais das receitas;
- imagens dos ingredientes;
- assets de marca;
- outros assets editoriais futuros.

Nunca armazenar imagens binárias dentro do D1.

O banco deve guardar apenas:

- object key;
- URL quando aplicável;
- metadata;
- versão;
- status.

Estrutura sugerida:

```text
recipes/
  {recipe-slug}/
    hero-v1.png
    hero-v2.png

ingredients/
  {ingredient-slug}.png

brand/
  logo/
  icons/

ui/
```

Os nomes devem ser previsíveis, consistentes e amigáveis para desenvolvimento.

Exemplo:

```text
ingredients/tomate.png
ingredients/abacate.png
ingredients/ovo.png

recipes/torrada-abacate-ovo/hero-v1.png
```

---

## Cloudflare Workers

Usar Workers como camada operacional entre frontend, D1 e R2.

Responsabilidades:

- CRUD de receitas;
- CRUD de ingredientes;
- uploads;
- leitura/escrita no R2;
- publicação;
- criação de lotes;
- aprovação/rejeição;
- consulta da biblioteca de assets;
- validações;
- detecção de possíveis duplicidades.

D1 e R2 devem ser acessados preferencialmente através de bindings Cloudflare.

---

# 4. Cloudflare Images

Não é requisito obrigatório do primeiro MVP.

A arquitetura deve permitir sua adição futura para:

- resize;
- thumbnails;
- WebP;
- AVIF;
- otimização;
- transformação dinâmica.

No MVP:

> R2 é suficiente.

---

# 5. Autenticação

O Studio deve ser privado.

Não criar sistema complexo de contas no MVP.

Preparar arquitetura para um acesso administrativo simples e seguro.

Pode ser utilizada uma solução compatível com Cloudflare Access ou mecanismo equivalente.

Nenhuma rota administrativa deve ficar publicamente acessível sem autenticação.

---

# 6. Estrutura principal

A aplicação deve ter apenas cinco áreas principais:

```text
Dashboard
Receitas
Ingredientes
Lotes
Revisão
```

Não adicionar áreas extras sem necessidade concreta.

---

# 7. Layout

Desktop-first.

O Studio será utilizado prioritariamente por desenvolvedores/equipe interna em desktop.

Estrutura:

```text
┌──────────────┬───────────────────────────────────────────┐
│              │                                           │
│   Sidebar    │                Conteúdo                   │
│              │                                           │
│ Dashboard    │                                           │
│ Receitas     │                                           │
│ Ingredientes │                                           │
│ Lotes        │                                           │
│ Revisão      │                                           │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

Sidebar estreita.

Visual limpo.

Evitar:

- dashboards cheios de gráficos;
- excesso de cards;
- gradientes decorativos;
- animações desnecessárias;
- visual de SaaS genérico.

---

# 8. DASHBOARD

O Dashboard deve oferecer apenas uma visão operacional rápida.

Não criar dashboard analítico.

Mostrar inicialmente:

### Lote atual

Exemplo:

```text
Lote #001
10 receitas

4 aprovadas
3 em revisão
3 pendentes
```

---

### Receitas

```text
126 receitas
112 publicadas
14 em produção
```

---

### Ingredientes

```text
184 ingredientes únicos
142 com imagem
42 sem imagem
```

Este indicador é especialmente importante.

---

### Revisão

Mostrar itens aguardando intervenção humana:

```text
5 receitas aguardando revisão
8 imagens aguardando aprovação
12 ingredientes sem asset
```

Cada item deve ser clicável.

---

# 9. RECEITAS

Página principal em formato de tabela.

Colunas:

```text
Receita
Categoria
Tempo
Ingredientes
Lote
Status
Atualizado
```

Status possíveis:

```text
draft
image_pending
review
approved
published
rejected
```

Mostrar labels amigáveis na interface:

```text
Rascunho
Imagem pendente
Em revisão
Aprovada
Publicada
Rejeitada
```

---

# 10. Busca e filtros

Permitir busca textual.

Filtros:

- status;
- categoria;
- ingrediente;
- lote;
- data.

Não criar filtros avançados no MVP.

---

# 11. Página de receita

Ao abrir uma receita, apresentar uma página simples dividida conceitualmente em:

```text
Informações
Imagem
Ingredientes
Status
```

---

## Informações

Mostrar e permitir edição de:

- nome;
- slug;
- descrição;
- categoria;
- tempo;
- porções;
- dificuldade;
- ingredientes;
- quantidades;
- preparo;
- tags relevantes.

---

## Imagem principal

Mostrar preview grande.

Informações:

```text
Arquivo
Object key
Versão
Status
Data
```

Ações:

```text
Aprovar
Rejeitar
Regenerar
Substituir
```

Preservar versões anteriores quando fizer sentido.

---

# 12. Ingredientes da receita

Para cada ingrediente mostrar:

```text
Nome
Quantidade
Unidade
Asset
Status
```

Exemplo:

```text
Abacate      1 unidade     ✓ disponível
Ovo          2 unidades    ✓ disponível
Limão        1/2 unidade   ✓ disponível
Pão          2 fatias      ✓ disponível
Pimenta      a gosto       ! sem imagem
```

A ausência de asset deve ser visualmente evidente.

---

# 13. Biblioteca de Ingredientes

Essa é uma das áreas mais importantes do Studio.

Cada ingrediente é uma entidade global reutilizável.

Nunca associar um novo arquivo separado de "tomate" para cada receita.

Exemplo:

```text
Ingredient

id: ingredient_tomato
name: Tomate
slug: tomate
asset_key: ingredients/tomate.png
status: approved
```

Todas as receitas que utilizarem tomate devem referenciar esse mesmo ingrediente.

---

# 14. Página Ingredientes

Tabela:

```text
Ingrediente
Preview
Receitas
Asset
Status
Atualizado
```

Exemplo:

```text
Abacate   [img]   17 receitas   ✓   Aprovado
Tomate    [img]   34 receitas   ✓   Aprovado
Tahine    [—]      3 receitas   !   Sem imagem
```

---

# 15. Cobertura de ingredientes

No topo da página mostrar:

```text
184 ingredientes únicos
142 com imagem
42 pendentes

77% de cobertura
```

Pode existir uma barra simples de progresso.

Não adicionar gráfico complexo.

---

# 16. Detecção de ingrediente existente

Durante criação/importação de uma receita:

Para cada ingrediente:

1. normalizar nome;
2. procurar correspondente;
3. verificar aliases;
4. verificar slug;
5. verificar asset existente;
6. reutilizar entidade quando encontrada.

Exemplo:

```text
"Tomates"
"Tomate"
"tomate fresco"
```

Não devem automaticamente virar três assets separados.

Quando houver dúvida:

```text
Possível correspondência encontrada:

Tomate fresco
→ Tomate

[Usar existente]
[Criar ingrediente]
```

---

# 17. Regra de geração de assets

ANTES de qualquer geração:

```pseudo
for ingredient in recipe.ingredients:
    existing = findIngredient(ingredient)

    if existing && existing.assetApproved:
        reuse(existing.asset)
    else:
        markAssetAsPending()
```

A geração deve atuar somente sobre:

```text
missing assets
```

Nunca sobre toda a lista de ingredientes.

---

# 18. LOTES

Receitas devem poder pertencer a lotes.

Exemplo:

```text
Lote #001
07/10/2026

10 receitas

4 aprovadas
3 em revisão
3 pendentes
```

Tabela:

```text
Receita
Imagem
Ingredientes
Revisão
Status
```

---

# 19. Página do lote

Mostrar progresso do lote.

Exemplo:

```text
Lote #001

████████████░░░░░  70%

Receitas:               10
Imagens principais:      8/10
Ingredientes novos:      7
Assets gerados:          5/7
Receitas aprovadas:      4/10
```

Abaixo:

```text
01 Torrada de Abacate com Ovo
✓ receita
✓ imagem
✓ ingredientes
✓ aprovada

02 Massa Cremosa de Abóbora
✓ receita
✓ imagem
! 2 ingredientes sem asset
○ revisão

...
```

---

# 20. REVISÃO

Criar uma Inbox operacional.

O objetivo é permitir revisão rápida sem navegar por dezenas de telas.

Categorias:

```text
Receitas
Imagens
Ingredientes
```

Cada item pode apresentar:

```text
Preview

Nome

Status

Problema ou ação necessária
```

Ações primárias:

```text
Aprovar
Rejeitar
Editar
Regenerar
```

---

# 21. Fluxo de aprovação

Utilizar estados claros.

Exemplo:

```text
draft
↓
image_pending
↓
review
↓
approved
↓
published
```

Estados alternativos:

```text
review
↓
rejected
↓
draft
```

Não permitir publicação acidental.

---

# 22. Publicação

A publicação deve ser uma ação explícita.

Uma receita só pode ser publicada quando:

```text
✓ dados válidos
✓ imagem principal aprovada
✓ ingredientes válidos
✓ assets obrigatórios disponíveis
✓ revisão aprovada
```

Caso contrário, mostrar claramente o motivo.

Exemplo:

```text
Não pode publicar

2 ingredientes ainda não possuem imagens aprovadas:

• Tahine
• Cebolinha
```

---

# 23. Duplicidade de receitas

Ao adicionar receita nova, executar detecção de possível duplicidade.

Não comparar apenas nomes.

Considerar:

- nome;
- ingredientes;
- proporção aproximada dos ingredientes;
- categoria;
- técnica/preparo.

Resultado:

```text
Possível duplicidade

Nova:
Torrada com Abacate e Ovo

Existente:
Torrada de Abacate com Ovo

Similaridade: alta

[Ver existente]
[Continuar mesmo assim]
```

No MVP, a lógica pode começar simples.

Não é necessário implementar embeddings ou IA complexa inicialmente.

---

# 24. Modelo de dados inicial

Criar entidades conceitualmente semelhantes a:

## recipes

```text
id
name
slug
description
category
prep_time
cook_time
servings
difficulty
instructions
status
batch_id
hero_asset_id
created_at
updated_at
published_at
```

---

## ingredients

```text
id
name
slug
normalized_name
status
asset_id
created_at
updated_at
```

---

## ingredient_aliases

```text
id
ingredient_id
alias
normalized_alias
```

---

## recipe_ingredients

```text
id
recipe_id
ingredient_id
quantity
unit
note
sort_order
```

---

## assets

```text
id
type
r2_key
filename
mime_type
version
status
created_at
updated_at
```

Tipos:

```text
recipe_hero
ingredient
brand
ui
```

---

## batches

```text
id
number
status
created_at
completed_at
```

---

# 25. IDs

Nunca usar nome visível como identificador interno permanente.

Utilizar IDs próprios.

Exemplo:

```text
recipe_01...
ingredient_01...
asset_01...
batch_01...
```

Slugs devem ser editáveis sem quebrar relacionamentos.

---

# 26. Asset Manager

O Studio também será o Asset Manager oficial do Receita da Hora.

Não é necessário criar uma seção separada "Assets" no MVP.

Os assets devem aparecer contextualizados dentro de:

```text
Receitas
Ingredientes
```

A arquitetura, porém, deve permitir uma futura página global de Assets.

---

# 27. Versionamento

Imagens principais podem possuir versões.

Exemplo:

```text
hero-v1.png
hero-v2.png
hero-v3.png
```

Somente uma versão fica ativa.

Registrar no banco:

```text
current_asset_id
```

ou estrutura equivalente.

Evitar sobrescrever silenciosamente imagens aprovadas.

---

# 28. Exclusão

Preferir soft-delete para entidades importantes.

Especialmente:

- receitas publicadas;
- ingredientes usados;
- assets aprovados.

Não permitir excluir ingrediente que esteja sendo utilizado sem mostrar impacto.

Exemplo:

```text
Este ingrediente é usado por 17 receitas.
```

---

# 29. UX

O Studio deve parecer uma ferramenta interna bem construída.

Referências conceituais:

- Linear;
- Vercel;
- Raycast;
- dashboards administrativos minimalistas.

Mas sem copiar visualmente nenhum produto.

Priorizar:

- muito espaço;
- boa tipografia;
- tabelas legíveis;
- estados claros;
- hierarquia visual;
- poucas cores;
- interfaces silenciosas.

---

# 30. Cores de status

Usar cores apenas como suporte.

Exemplo conceitual:

```text
Neutral   Draft
Yellow    Pending
Blue      Review
Green     Approved / Published
Red       Rejected / Error
```

Nunca depender apenas da cor.

Sempre incluir texto ou ícone.

---

# 31. Componentes

Criar componentes reutilizáveis como:

```text
Sidebar
PageHeader
StatusBadge
DataTable
FilterBar
SearchInput
RecipeCard
IngredientRow
AssetPreview
AssetStatus
BatchProgress
ReviewCard
EmptyState
ConfirmDialog
```

Não abstrair prematuramente.

---

# 32. Estados vazios

Tratar estados vazios adequadamente.

Exemplo:

```text
Nenhum ingrediente sem imagem.

A biblioteca está 100% coberta.
```

ou:

```text
Nenhuma receita aguardando revisão.
```

Não deixar tabelas vazias sem explicação.

---

# 33. Erros

Erros devem explicar:

- o que aconteceu;
- o que não foi salvo;
- possível ação.

Exemplo:

```text
Não foi possível enviar a imagem para o R2.

A receita foi preservada como rascunho.

[Tentar novamente]
```

---

# 34. Segurança

Nunca expor:

- R2 credentials;
- API tokens;
- secrets;
- tokens administrativos;

no frontend.

Usar variáveis de ambiente e Cloudflare bindings apropriados.

---

# 35. Ambiente

Preparar:

```text
development
production
```

Evitar que desenvolvimento escreva acidentalmente no bucket ou banco de produção.

---

# 36. Seeds

Criar dados seed para desenvolvimento.

Exemplo:

```text
Lote #001

Torrada de Abacate com Ovo
Massa Cremosa de Abóbora

Ingredientes:
Abacate
Ovo
Pão
Limão
Abóbora
Pimentão
```

Incluir combinações de:

- aprovado;
- pendente;
- sem imagem;
- rejeitado.

Isso permitirá testar todos os estados da interface.

---

# 37. Primeira implementação

Não tentar implementar todo o sistema simultaneamente.

Construir nesta ordem:

## Phase 1 — Foundation

- projeto;
- layout;
- autenticação;
- D1;
- migrations;
- R2;
- Workers bindings;
- schema inicial.

## Phase 2 — Dashboard

- métricas;
- lote atual;
- pendências.

## Phase 3 — Ingredientes

- CRUD;
- aliases;
- upload R2;
- asset preview;
- cobertura.

## Phase 4 — Receitas

- CRUD;
- relacionamento com ingredientes;
- imagem principal;
- status.

## Phase 5 — Lotes

- criação;
- associação;
- progresso.

## Phase 6 — Revisão

- inbox;
- aprovação;
- rejeição;
- regeneração futura.

## Phase 7 — Publicação

- validação;
- publish;
- endpoint consumível pelo Receita da Hora.

---

# 38. Fora do MVP

Não implementar inicialmente:

- analytics avançado;
- gráficos complexos;
- permissões detalhadas por usuário;
- múltiplos times;
- comentários;
- histórico editorial complexo;
- workflow configurável;
- IA autônoma;
- geração automática sem revisão;
- Cloudflare Images obrigatório;
- DAM completo;
- notificações;
- app mobile do Studio.

---

# 39. Princípio de automação

Preparar a arquitetura para que no futuro o Studio consiga receber automaticamente um lote diário.

Porém:

> geração e publicação são coisas diferentes.

Conteúdo gerado automaticamente sempre entra inicialmente como:

```text
draft
```

ou:

```text
review
```

Nunca publicar automaticamente no MVP.

---

# 40. API para o Receita da Hora

Preparar uma camada pública separada da administração.

Exemplo conceitual:

```text
/api/public/recipes
/api/public/recipes/:slug
/api/public/categories
```

Esses endpoints devem retornar apenas conteúdo publicado.

Nunca expor:

- drafts;
- rejeitados;
- metadata interna;
- informações administrativas.

---

# 41. Critério de sucesso do MVP

O Studio está funcional quando for possível realizar este fluxo completo:

```text
1. Criar Lote #001

2. Adicionar 10 receitas

3. O sistema identifica os ingredientes

4. Ingredientes existentes são reutilizados

5. Ingredientes novos aparecem como "sem asset"

6. Upload das imagens faltantes para R2

7. Associar imagem principal às receitas

8. Revisar cada receita

9. Aprovar

10. Publicar

11. Receita da Hora consegue consumir as receitas publicadas
```

Sem editar banco manualmente.

Sem mover arquivos manualmente.

Sem verificar pastas manualmente.

---

# 42. Regra de produto

Sempre que surgir dúvida entre:

```text
mais funcionalidades
```

e:

```text
fluxo mais simples
```

escolher:

> fluxo mais simples.

O Studio existe para reduzir trabalho operacional.

Não para criar trabalho operacional.

---

# 43. Resultado esperado da primeira execução

Antes de começar a codificar indiscriminadamente:

1. analisar esta especificação;
2. propor estrutura de diretórios;
3. definir schema D1;
4. definir bindings Cloudflare;
5. definir rotas;
6. definir componentes principais;
7. identificar decisões técnicas ainda necessárias;
8. implementar a fundação;
9. implementar o primeiro fluxo vertical completo.

Priorizar um **vertical slice funcional**:

```text
Ingrediente
↓
D1
↓
Upload de imagem
↓
R2
↓
Preview no Studio
↓
Status aprovado
```

Depois avançar para o restante.

Evitar mocks permanentes quando a infraestrutura real já puder ser utilizada.

---

# 44. Direção final

O objetivo não é construir um grande CMS.

O objetivo é construir uma ferramenta interna que torne este processo:

```text
receita
→ asset
→ revisão
→ aprovação
→ publicação
```

extremamente fácil de visualizar e operar.

Nome interno:

# Receita da Hora Studio

Princípio:

> Uma única fonte de verdade para todo o conteúdo e todos os assets do Receita da Hora.
