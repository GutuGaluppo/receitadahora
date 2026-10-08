# RECEITA DA HORA STUDIO — FÁBRICA DE CONTEÚDO

Implemente dentro do **Receita da Hora Studio** um módulo interno chamado **Content Factory**.

O objetivo é transformar o Studio de um simples painel administrativo em uma ferramenta operacional capaz de:

- gerar novas receitas;
- gerar conteúdo estruturado;
- detectar duplicidades;
- reutilizar ingredientes existentes;
- identificar assets ausentes;
- preparar geração de imagens;
- revisar conteúdo;
- aprovar;
- publicar.

A Content Factory deve funcionar como uma **linha de produção editorial assistida**, nunca como um sistema autônomo que publica conteúdo sem revisão humana.

---

# 1. Princípio central

A fábrica deve seguir este fluxo:

```text
Brief
↓
Geração
↓
Validação
↓
Detecção de duplicidade
↓
Normalização de ingredientes
↓
Verificação de assets existentes
↓
Preparação de assets ausentes
↓
Revisão humana
↓
Aprovação
↓
Publicação
```

Regra fundamental:

> Gerar somente o que ainda não existe.

Isso vale principalmente para:

- ingredientes;
- imagens de ingredientes;
- receitas muito semelhantes;
- assets editoriais reaproveitáveis.

---

# 2. Feature flags

Toda funcionalidade que possa gerar custos externos deve nascer desativada.

Criar feature flags como:

```env
CONTENT_GENERATION_ENABLED=false
IMAGE_GENERATION_ENABLED=false
AUTO_BATCH_GENERATION_ENABLED=false
```

Comportamento esperado:

- nenhuma chamada paga deve acontecer quando a flag correspondente estiver desativada;
- botões podem ficar ocultos ou visualmente desativados;
- backend deve bloquear a operação mesmo que o frontend seja manipulado;
- exibir mensagem clara explicando que a funcionalidade está desativada.

Exemplo:

```text
Image generation is currently disabled.
Enable IMAGE_GENERATION_ENABLED to use this feature.
```

---

# 3. Área principal

Adicionar uma nova área ao Studio:

```text
Dashboard
Receitas
Ingredientes
Lotes
Revisão
Factory
```

Nome da seção na interface:

# Factory

Subáreas:

```text
Generate
Queue
History
Templates
Settings
```

No MVP, apenas `Generate`, `Queue` e `History` precisam estar funcionais.

---

# 4. Tela Generate

Criar uma tela simples para iniciar uma geração.

Campos:

```text
Quantidade de receitas
Categoria
Momento do dia
Tempo máximo
Dificuldade
Restrições
Ingredientes desejados
Ingredientes a evitar
Observações
```

Valores opcionais.

Exemplo:

```text
Quantidade: 10
Categoria: Jantar
Tempo máximo: 30 min
Dificuldade: Fácil
Objetivo: receitas rápidas para dias de semana
```

Botão principal:

```text
Generate Batch
```

Se `CONTENT_GENERATION_ENABLED=false`:

```text
Generation disabled
```

---

# 5. Templates de geração

A fábrica deve trabalhar com templates versionados.

Criar entidade:

```text
generation_templates
```

Campos:

```text
id
name
type
version
prompt
is_active
created_at
updated_at
```

Tipos:

```text
recipe
recipe_image
ingredient_image
description
metadata
```

Nunca deixar prompts críticos hardcoded diretamente em componentes de UI.

---

# 6. Recipe Generation Template

Criar um template base para receitas.

O modelo deve receber contexto estruturado como:

```json
{
	"count": 10,
	"category": "dinner",
	"max_time": 30,
	"difficulty": "easy",
	"avoid_recipe_ids": [],
	"existing_recipe_names": [],
	"existing_ingredients": []
}
```

Retornar exclusivamente JSON estruturado.

Formato esperado:

```json
{
	"recipes": [
		{
			"name": "",
			"description": "",
			"category": "",
			"prep_time": 0,
			"cook_time": 0,
			"servings": 0,
			"difficulty": "",
			"ingredients": [
				{
					"name": "",
					"quantity": "",
					"unit": "",
					"note": ""
				}
			],
			"instructions": [],
			"tags": []
		}
	]
}
```

Validar o resultado antes de persistir.

Nunca confiar diretamente na saída do modelo.

---

# 7. Pipeline de validação

Após geração:

```text
LLM output
↓
JSON parse
↓
schema validation
↓
normalization
↓
duplicate detection
↓
ingredient matching
↓
draft creation
```

Se qualquer etapa falhar:

- não perder o resultado bruto;
- registrar erro;
- marcar job como `failed`;
- permitir retry.

---

# 8. Jobs

Toda geração deve ser tratada como um job.

Criar entidade:

```text
generation_jobs
```

Campos sugeridos:

```text
id
type
status
batch_id
template_id
template_version
input_payload
output_payload
error_message
estimated_cost
actual_cost
created_at
started_at
completed_at
```

Status:

```text
queued
processing
completed
failed
cancelled
disabled
```

---

# 9. Queue

Tela `Factory > Queue`.

Mostrar:

```text
Job
Tipo
Lote
Status
Itens
Criado
Duração
```

Exemplo:

```text
#GF-102
Recipe generation
Lote #017
Completed
10 recipes
07/10/2026
```

Permitir:

```text
View
Retry
Cancel
```

Não permitir retry automático infinito.

---

# 10. Histórico

Tela:

```text
Factory > History
```

Mostrar geração passada.

Filtros:

```text
Tipo
Status
Data
Lote
Template version
```

Cada job deve ser auditável.

---

# 11. Batch creation

Ao solicitar um conjunto de receitas, criar automaticamente um lote.

Exemplo:

```text
Lote #018
Factory
10 receitas
Status: generating
```

As receitas aprovadas posteriormente continuam pertencendo ao mesmo lote.

---

# 12. Duplicidade

Antes de persistir uma receita gerada, comparar com receitas existentes.

Primeiro nível:

```text
normalized title
```

Segundo nível:

```text
ingredient overlap
category
main technique
```

Terceiro nível futuro:

```text
semantic similarity
```

No MVP, evitar embeddings se não forem necessários.

Resultado possível:

```text
High similarity detected

Generated:
Creamy Pumpkin Pasta

Existing:
Pumpkin Cream Pasta

Similarity: 89%
```

Ações:

```text
Discard
Keep as draft
Compare
```

Nunca descartar automaticamente sem registro.

---

# 13. Normalização de ingredientes

Todos os ingredientes retornados pela geração devem passar pela biblioteca global.

Pipeline:

```text
generated ingredient
↓
normalize name
↓
search exact match
↓
search alias
↓
search normalized name
↓
suggest match
↓
reuse or create
```

Exemplo:

```text
Tomates-cereja
Cherry tomato
Tomate cereja
```

Devem, quando apropriado, apontar para a mesma entidade.

---

# 14. Ingredient resolution

Criar serviço:

```text
resolveIngredient()
```

Resultado:

```ts
{
  status: "matched" | "suggested" | "new",
  ingredientId?: string,
  confidence?: number
}
```

Não criar automaticamente novas entidades quando a correspondência for ambígua.

---

# 15. Missing assets

Após resolver ingredientes:

```text
recipe ingredients
↓
ingredient library
↓
asset check
```

Resultado:

```text
7 ingredients reused
2 ingredients missing assets
1 new ingredient
```

Mostrar isso claramente antes da revisão.

---

# 16. Asset generation queue

Criar suporte estrutural para geração futura de imagens.

Tipos de job:

```text
recipe_image
ingredient_image
```

Mas inicialmente:

```env
IMAGE_GENERATION_ENABLED=false
```

Comportamento:

```text
Missing ingredient asset
↓
Create pending asset job
↓
Do not execute
↓
Status: disabled
```

Assim a pipeline já fica pronta sem custo.

---

# 17. OpenAI image integration

Preparar abstração:

```ts
ImageGenerationProvider;
```

Exemplo:

```ts
interface ImageGenerationProvider {
	generateRecipeImage(input): Promise<Result>;
	generateIngredientImage(input): Promise<Result>;
}
```

Criar implementação futura:

```text
OpenAIImageProvider
```

Não acoplar componentes do Studio diretamente à OpenAI API.

---

# 18. Image generation flow

Quando futuramente habilitado:

```text
recipe
↓
build prompt
↓
OpenAI Images API
↓
temporary result
↓
validation
↓
R2 upload
↓
asset record
↓
review
```

Nunca publicar diretamente.

---

# 19. Recipe Photography System

Criar um template dedicado:

```text
Recipe Photography System
```

Versionado.

Exemplo:

```text
recipe-photography-v0.2
```

Todo asset deve registrar:

```text
generation_template_id
generation_template_version
provider
model
prompt
```

Isso permite rastrear exatamente como cada imagem foi criada.

---

# 20. Image prompt composition

O prompt da imagem deve ser montado a partir de:

```text
base visual system
+
recipe name
+
ingredients
+
presentation
+
composition rules
+
background rules
+
negative constraints
```

Nunca depender de prompt manual escrito toda vez.

---

# 21. Ingredient image generation

Antes de gerar:

```ts
if (ingredient.asset?.status === "approved") {
	return reuseAsset();
}
```

Somente gerar quando:

```text
asset missing
asset rejected
asset explicitly requested for replacement
```

Nunca regenerar automaticamente um asset aprovado.

---

# 22. Recipe image versioning

Cada nova geração deve criar nova versão:

```text
hero-v1
hero-v2
hero-v3
```

Nunca sobrescrever silenciosamente a anterior.

Estados:

```text
generated
review
approved
rejected
archived
```

Somente uma versão pode estar ativa.

---

# 23. Factory review

Após conclusão de geração, mostrar resumo:

```text
Batch #018

10 generated recipes

7 ready for review
2 possible duplicates
1 invalid
14 reused ingredient assets
3 missing ingredient assets
10 recipe images pending
```

Ações:

```text
Review Recipes
Resolve Duplicates
Resolve Ingredients
Prepare Assets
```

---

# 24. Recipe review screen

Tela otimizada para decisão rápida.

Mostrar:

```text
Name
Description
Time
Category
Ingredients
Instructions
Warnings
Duplicate score
Asset coverage
```

Ações:

```text
Approve
Edit
Reject
Regenerate
```

---

# 25. Regeneration

Regeneração deve ser granular.

Permitir:

```text
Regenerate entire recipe
Regenerate description
Regenerate instructions
Regenerate image
```

Não regenerar uma receita inteira se apenas a descrição estiver ruim.

---

# 26. Provenance

Toda informação gerada deve guardar origem.

Campos conceituais:

```text
source_type
source_job_id
template_version
provider
model
generated_at
approved_by
approved_at
```

Valores possíveis:

```text
manual
generated
imported
```

---

# 27. Cost tracking

Mesmo com geração desabilitada inicialmente, preparar suporte a custos.

Por job:

```text
estimated_cost
actual_cost
currency
```

Dashboard futuro:

```text
Today
$0.00

This month
$0.00
```

Não transformar isso em analytics complexo.

Apenas transparência operacional.

---

# 28. Spending guardrails

Preparar configuração:

```env
DAILY_GENERATION_LIMIT=0
MONTHLY_GENERATION_BUDGET=0
```

Quando APIs pagas forem ativadas:

```text
requested generation
↓
budget check
↓
allowed / blocked
```

Nunca exceder limite configurado silenciosamente.

---

# 29. Manual approval

Nenhum conteúdo gerado por IA deve passar diretamente para:

```text
published
```

Estado obrigatório:

```text
generated
↓
review
↓
approved
↓
published
```

---

# 30. Factory dashboard

Adicionar pequeno bloco no Dashboard principal:

```text
Factory

Current batch
#018

10 generated
7 review
2 duplicate warnings
3 missing assets
```

Sem gráficos.

---

# 31. Factory states

Padronizar:

```text
Idle
Generating
Validating
Needs review
Blocked
Completed
Failed
```

---

# 32. Error handling

Exemplo:

```text
Recipe generation failed

The generated response could not be validated.

The raw result was preserved.

[View details]
[Retry]
```

Outro exemplo:

```text
Image generation unavailable

The image provider is currently disabled.

No API request was made.
```

---

# 33. Provider abstraction

Toda geração externa deve ficar atrás de provider abstractions.

Exemplo:

```text
RecipeGenerationProvider
ImageGenerationProvider
```

Isso permite futuramente:

```text
OpenAI
local model
another provider
```

sem reescrever a Factory.

---

# 34. API keys

Nunca expor no frontend.

Usar:

```text
Cloudflare secrets
Worker environment variables
```

Toda comunicação com providers deve ocorrer server-side.

---

# 35. Observability

Registrar:

```text
job started
job completed
job failed
tokens/usage when available
cost
duration
provider
model
```

Não registrar secrets.

Evitar logs contendo payloads sensíveis sem necessidade.

---

# 36. Retry policy

Falhas externas:

```text
network
timeout
provider 5xx
```

podem permitir retry.

Falhas estruturais:

```text
invalid JSON
invalid schema
duplicate conflict
```

devem exigir tratamento apropriado.

Não criar loops automáticos caros.

---

# 37. Idempotência

A Factory deve evitar criar duas vezes o mesmo job por clique duplicado.

Usar:

```text
idempotency key
```

principalmente para:

```text
Generate Batch
Generate Image
Publish
```

---

# 38. Database entities

Adicionar conceitualmente:

## generation_jobs

```text
id
type
status
batch_id
template_id
template_version
provider
model
input_payload
output_payload
error_message
estimated_cost
actual_cost
created_at
started_at
completed_at
```

## generation_templates

```text
id
name
type
version
prompt
is_active
created_at
updated_at
```

## generation_events

```text
id
job_id
event_type
message
created_at
```

---

# 39. Events

Exemplos:

```text
job.created
job.started
recipe.generated
duplicate.detected
ingredient.matched
ingredient.created
asset.reused
asset.missing
job.completed
job.failed
```

Usar isso para montar histórico legível.

---

# 40. Initial implementation order

Construir nesta ordem:

## Phase 1

Factory shell:

```text
Factory
Generate
Queue
History
```

## Phase 2

Job model e pipeline.

## Phase 3

Recipe generation provider abstraction.

## Phase 4

Recipe validation.

## Phase 5

Duplicate detection.

## Phase 6

Ingredient resolution.

## Phase 7

Missing asset detection.

## Phase 8

Image generation abstraction.

## Phase 9

OpenAI image integration desativada por feature flag.

## Phase 10

Cost tracking e guardrails.

---

# 41. Primeiro vertical slice

Implementar primeiro:

```text
Create generation job
↓
Generate mock recipe set
↓
Validate
↓
Create batch
↓
Resolve ingredients
↓
Detect missing assets
↓
Create recipes as draft
↓
Show in Review
```

Usar provider mock inicialmente.

Depois substituir pelo provider real.

---

# 42. Mock provider

Criar:

```text
MockRecipeGenerationProvider
```

Ele deve retornar conteúdo previsível para desenvolvimento.

Isso permite implementar toda a fábrica sem depender de APIs pagas.

---

# 43. Image provider no MVP

Criar:

```text
DisabledImageGenerationProvider
```

Comportamento:

```text
return {
  status: "disabled"
}
```

Assim toda a arquitetura de imagem fica integrada sem custo.

---

# 44. UX principle

A Factory não deve parecer um chatbot.

Evitar:

```text
conversation UI
message bubbles
chat history
prompt box gigante
```

O conceito é:

> ferramenta editorial estruturada

e não:

> ChatGPT dentro do dashboard.

---

# 45. Factory mental model

O usuário deve sentir que está operando uma pequena linha de produção:

```text
Input
↓
Generate
↓
Inspect
↓
Resolve
↓
Approve
↓
Publish
```

Cada estágio deve ter estado claro.

---

# 46. Não automatizar demais

Não implementar inicialmente:

```text
auto publish
automatic scheduled generation
automatic regeneration loops
automatic asset replacement
autonomous recipe selection
```

Essas capacidades podem existir futuramente.

---

# 47. Preparação para geração diária

A arquitetura deve permitir futuramente:

```text
Daily batch
10 recipes
```

Mas não ativar agendamento automático no MVP.

A geração deve começar por ação manual:

```text
Generate Batch
```

---

# 48. Relação com o Studio

A Factory não cria uma base paralela.

Tudo gerado deve entrar diretamente nas entidades existentes:

```text
Recipes
Ingredients
Assets
Batches
Review
```

A Factory apenas cria e orquestra conteúdo.

O Studio continua sendo a fonte de verdade.

---

# 49. Critério de sucesso

A Factory está pronta quando o seguinte fluxo funciona:

```text
1. Abrir Factory

2. Solicitar 10 receitas

3. Criar job

4. Gerar receitas via mock provider

5. Validar estrutura

6. Detectar duplicidades

7. Resolver ingredientes

8. Reutilizar ingredientes existentes

9. Identificar assets ausentes

10. Criar lote

11. Salvar receitas como draft

12. Enviar para Review

13. Aprovar manualmente

14. Publicar através do fluxo existente
```

Tudo isso sem:

```text
copiar prompts
colar respostas
editar banco manualmente
mover arquivos manualmente
```

---

# 50. Estado inicial obrigatório

Após implementação:

```env
CONTENT_GENERATION_ENABLED=true
IMAGE_GENERATION_ENABLED=false
AUTO_BATCH_GENERATION_ENABLED=false
```

A geração textual pode funcionar via provider configurado ou mock.

A geração de imagens deve permanecer inativa até decisão explícita futura.

Nenhuma chamada à Images API deve ocorrer enquanto:

```text
IMAGE_GENERATION_ENABLED=false
```

---

# 51. Direção final

O Receita da Hora Studio deixa de ser apenas:

> um lugar onde o conteúdo é armazenado.

Ele passa a ser:

> o lugar onde o conteúdo nasce, é organizado, validado, revisado e publicado.

Mas sempre obedecendo a três princípios:

### 1. Reutilizar antes de gerar

### 2. Revisar antes de publicar

### 3. Automatizar apenas quando a automação realmente economizar trabalho
