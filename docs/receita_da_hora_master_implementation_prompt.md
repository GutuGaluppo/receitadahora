# RECEITA DA HORA — MASTER IMPLEMENTATION PROMPT

## Índice

- [Objetivo do Produto](#objetivo-do-produto)
- [Princípios de UX](#princípios-de-ux)
- [Escopo MVP](#escopo-mvp)
- [Stack Técnica](#stack-técnica)
- [Identidade Visual](#identidade-visual)
- [Fluxo de Interface](#fluxo-de-interface)
- [Motor de Recomendação](#motor-de-recomendação)
- [Dados e Persistência](#dados-e-persistência)
- [Implementação](#implementação)
- [Performance e Deployment](#performance-e-deployment)

---

## Objetivo do Produto

Criar uma aplicação web premium de sugestões de receitas contextuais.

O produto deve responder a uma pergunta simples:

> **O que faz sentido comer agora?**

A sugestão deve considerar:

- hora do dia;
- tempo disponível para preparo;
- clima da região;
- restrições alimentares;
- objetivos do usuário;
- rotina;
- preferências aprendidas;
- histórico de receitas curtidas ou rejeitadas.

O produto não deve parecer um catálogo de receitas.

A proposta de uso é:

> **abrir o app → receber uma sugestão relevante → aceitar ou ajustar → cozinhar → salvar → ensinar o sistema sobre seu gosto**

## Princípios de UX

### Princípio Central

A interface deve ser extremamente simples.

Regra de design:

> **A fotografia fala. A interface cala.**

### O que evitar

Não criar aparência de:

- dashboard;
- marketplace;
- Pinterest;
- app fitness;
- feed social;
- catálogo tradicional de receitas.

**Não adicionar:**
- navbar convencional;
- sidebar;
- filtros permanentemente visíveis;
- elementos apenas porque são comuns em aplicações web.

### Teste de Necessidade

Antes de incluir qualquer elemento, pergunta-se:

> O usuário precisa disso exatamente neste momento?

Se a resposta é não, o elemento deve estar oculto ou não deve existir.

## Escopo MVP

### Plataforma

Construir uma aplicação **web responsiva** — desktop e mobile.

**Não incluir** aplicativo nativo nesta etapa.

### Features do MVP

**Core (essencial):**
1. Home contextual com sugestão
2. Visualização de receita expandida (sem page reload)
3. Solicitar outra sugestão com preferências temporárias
4. Onboarding rápido (4 telas máximo)
5. Biblioteca de receitas salvas
6. Salvar/remover receita
7. Feedback simples (Gostei / Não é pra mim)
8. Motor de recomendação determinístico (scoring)
9. Persistência do perfil de preferências
10. Responsividade (mobile, tablet, desktop)

**Integração (secundária):**
- Clima e localização (ativa, mas não obrigatória)
- Contexto dinâmico baseado em hora

**Não incluir no MVP:**
- IA generativa de receitas
- Planejamento de refeições
- Lista de compras
- Integração com e-commerce
- Sistema de planos semanais
- Notificações
- Gamificação

## Stack Técnica

### Recomendação

| Layer | Tecnologia | Versão | Justificativa |
|-------|------------|--------|---------------|
| **Framework** | Next.js | 14+ | App Router, SSR, image optimization nativa |
| **Linguagem** | TypeScript | 5+ | Type safety para logic de recomendação complexa |
| **UI Library** | React | 18+ | Estabilidade, suspense boundaries |
| **Estilos** | Tailwind CSS | 3+ | Utility-first, dynamic colors com CSS vars |
| **Motion** | Framer Motion | 10+ | Layout animations, gesture support |
| **Banco** | Supabase | (PostgreSQL) | Autenticação, realtime, edge functions |
| **Validação** | Zod | 3+ | Schema validation para API responses |
| **Formulários** | React Hook Form | 7+ | Performance, integração com validação |
| **Cliente HTTP** | fetch/TanStack Query | - | Built-in, caching de dados |

### Arquitetura de Componentes

```txt
Next.js App Router
├─ Server Components (default)
│  └─ Renderizam dados estáticos e layout
└─ Client Components (interatividade)
   └─ Apenas onde necessário (state, listeners, animations)
```

### Motion & Animação

**Usar Framer Motion para:**
- Transições de layout (imagem reduz, conteúdo entra)
- Mudanças de estado (receita → detalhe → feedback)
- Gestos (swipe para próxima receita em mobile)

**Nunca:**
- Animar cada interação
- Usar springs fortes ou bounces
- Criar efeitos decorativos que não agregam
- Ignorar `prefers-reduced-motion`

**Duração padrão:** 400–600ms para transições principais.

## Identidade Visual

### Princípio de Variação

A aplicação possui identidade visual que **muda por receita**, mas layout permanece **sempre consistente**.

### Elementos Dinâmicos

Cada receita define sua paleta (via `RecipePalette`):

```ts
{
  background: string;           // fundo principal
  backgroundSecondary?: string; // opcional, gradiente
  accent: string;               // destaques
  accentStrong: string;         // ícone biblioteca
  text: string;                 // texto principal
  mutedText: string;            // texto secundário
}
```

**Elementos que mudam:**
- Background (cor ou gradiente)
- Cores de destaque
- Cor do ícone da Biblioteca
- Temperatura visual (quente/frio/neutro)

**O que NÃO muda:**
- Estrutura e posição dos elementos
- Tamanho de tipografia
- Espaçamento
- Área de cliques

### Exemplos de Paletas

| Receita | Background | Accent | Textura |
|---------|-----------|--------|---------|
| **Abóbora** | cream | terracotta | warm, comfort |
| **Salada fresca** | soft green | pale lemon | light, fresh |
| **Curry** | saffron | deep wine | rich, warm |
| **Sopa** | deep neutral | brick/amber | cozy, earthy |

### Transição Visual

As mudanças entre receitas devem ser **suaves**, nunca abruptas.

Usar fade na cor de fundo + transição gradual.

Nada deve parecer temático demais ou carnavalesco.

## Fotografia

### Estilo

Preferir imagens da receita que:

- sejam **recortadas** (sem plano de fundo)
- apareçam **isoladas** no espaço
- tenham sombra suave (depth)
- se integrem à composição (não sejam blocos)
- pareçam um **objeto editorial** na página

### Composição

Evitar:
- Grandes blocos retangulares de foto
- Imagens que dominam 100% da largura
- Fotografias com bordas duras

Preferir:
- Imagens menores, bem posicionadas
- Integração natural ao texto
- Variedade de tamanhos conforme contexto

### Otimização

- **Formato:** WebP com fallback JPEG
- **Tamanho:** Otimizar para mobile (máx 500KB)
- **Alt text:** Descritivo para acessibilidade

## Fluxo de Interface

### Home — Estado Fechado

A Home deve conter **somente**:

1. Sugestão contextual (imagem + nome + descrição)
2. Ação principal: `Ver receita`
3. Ação secundária: `Outra sugestão`
4. Botão biblioteca (discreto, canto superior direito)

**Sem navbar. Sem sidebar. Sem filtros visíveis.**

**Exemplo visual:**

```
┌──────────────────────────┐
│ [biblioteca]             │
├──────────────────────────┤
│                          │
│     [imagem grande]      │
│                          │
├──────────────────────────┤
│ Pasta cremosa de abóbora │
│                          │
│ Quente, cremosa e        │
│ reconfortante para uma   │
│ noite fria.              │
│                          │
│   [Ver receita]          │
│    Outra sugestão        │
└──────────────────────────┘
```

### Home — State Machine

```ts
type HomeState =
  | "suggestion"      // Mostrando receita
  | "recipeOpen"      // Receita expandida
  | "alternativePrompt" // Pergunta de preferência
  | "switchingRecipe"; // Transição entre receitas

type LibraryState =
  | "closed" | "open";
```

### Transição: Ver Receita

**Não navegar para nova página — reorganizar no lugar.**

#### Desktop

```
1. Imagem grande centralizada
   ↓ (500ms)
2. Imagem reduz 30% (40% da tela)
   Move para canto superior esquerdo
   ↓
3. Receita aparece à direita (60% da tela)
   Conteúdo faz fade-in
```

**Layout final:**
- Esquerda (40%): imagem, titulo, metadata, feedback, salvar
- Direita (60%): ingredientes, modo de preparo

#### Mobile

```
1. Imagem grande (100vw)
   ↓ (500ms)
2. Imagem reduz, permanece no topo
   (ocupar espaço lógico)
   ↓
3. Receita aparece abaixo em scroll natural
```

**Layout mobile:**
```
imagem (50-60vh)
título
metadata
feedback buttons
ingredientes
modo de preparo (com passos numerados)
salvar
```

**Não tornar imagem sticky no mobile** — scroll natural é melhor.

#### Propriedades de Transição

**Usar:**
- `transform` (translate, scale)
- `opacity` (fade)
- Layout animations (reflow)

**Evitar:**
- bounce ou springs fortes
- glow ou box-shadow animados
- zoom dramático
- múltiplas animações simultâneas

**Duração:** 500–650ms

### Receita — Estrutura

```
┌────────────────────────┐
│ Pasta cremosa de       │
│ abóbora e pimentão     │
│                        │
│ 25 min · Serve 2 · 340 cal
│                        │
│ ─────────────────────── │
│                        │
│ INGREDIENTES           │
│ □ Abóbora (400g)       │
│ □ Pimentão vermelho    │
│ □ Cebola média         │
│ □ Alho (2 dentes)      │
│ □ Caldo (500ml)        │
│                        │
│ ─────────────────────── │
│                        │
│ MODO DE PREPARO        │
│                        │
│ 01. Cortar a abóbora   │
│     em cubos...        │
│                        │
│ 02. Aquecer a panela   │
│     ...                │
│                        │
│ [Salvar receita]       │
│                        │
│ Gostei  ·  Não é pra mim
└────────────────────────┘
```

**Detalhes:**
- Ingredientes com checkboxes (usuário marca enquanto prepara)
- Passos numerados (`01`, `02`...) com texto fluido
- Tipografia clara, sem cards visuais pesados

## Receita

Mostrar somente informações úteis.

Estrutura:

```txt
Nome

25 min · Serve 2

Ingredientes

Modo de preparo

Salvar receita
```

Passos numerados:

```txt
01
02
03
04
```

Evitar blocos visuais excessivos.

### Outra Sugestão

Ao clicar em `Outra sugestão`, **não trocar imediatamente** por algo aleatório.

Mostrar pergunta contextual:

```
O que combina melhor com você agora?
```

Opções (usuário escolhe uma):

```
Mais rápido (priorizar receitas < 20min)
Mais leve (priorizar proteína alta, baixa caloria)
Algo reconfortante (aumentar "comfort" score)
Surpreenda-me (aumentar novelty, fora da rotina)
```

**Implementação:**
- Não abrir modal pesado
- Mostrar opções integradas ao layout
- Valores ficam ativos por 1 sessão (não persistem em perfil)
- Próximas sugestões respeitam a escolha até usuário mudar de receita

### Troca de Receita

**Fluxo visual:**

```
1. Receita atual (opacity: 0.5) + fade out gradual
   ↓ (300ms)
2. Imagem troca (nova receita entra)
   Background migra para nova paleta
   ↓ (200ms)
3. Conteúdo troca (ingredientes, modo de preparo)
   Novo conteúdo faz fade-in
   ↓ (300ms)
4. Estado final: nova receita visível e interativa
```

**Duração total:** ~600ms

**Não usar:** skeleton screens complexos, loaders pesados

## Biblioteca

### Conceito

A Biblioteca é a **única navegação persistente** visível na Home.

Não há menu, navbar ou engrenagem de settings na Home.

### Ícone

**Conceito visual:** bookmark + pequena pilha (evoca "salved recipes stacked")

**Posição:** top-right

**Tamanho:** 44×44px mínimo (área clicável)

**Cor:** Acompanha `accentStrong` da receita atual
- Sólida e claramente visível
- Harmonizada com a paleta
- Nunca cinza invisível
- O tamanho + simplicidade garantem discrição

**Hover:** Pequena alteração tonal (+10–15% brightness), sem glow ou animação chamativa

**Evitar ícones de:** livro aberto, pasta, coração, grids

### Desktop — Drawer

```
[Home visível: 55%] [Drawer: 45%]
```

- Abrir painel da direita (38–45vw de largura)
- Home continua visível atrás (pouco overlay)
- Scroll próprio no drawer
- Close button discreto
- Voltar à Home mantém scroll

### Mobile — Fullscreen Drawer

```
Tela toda
```

- Slide from right
- Close button (X) no topo
- Voltar retorna ao **exato estado anterior** na Home
- Nunca resetar scroll ou state da Home

### Conteúdo da Biblioteca

**Estrutura no MVP:**

```
┌─ Biblioteca ─────────┐
│                      │
│ Receitas salvas (5)  │
│                      │
│ [imagem] Pasta      │
│ cremosa             │
│ 25 min              │
│                      │
│ [imagem] Salada     │
│ verde               │
│ 10 min              │
│                      │
│ ────────────────────│
│                      │
│ Meu Gosto           │
│ (editar preferências)
│                      │
└──────────────────────┘
```

**Por item (Receitas salvas):**
- Imagem (thumbnail)
- Nome
- Tempo de preparo
- NO MÁXIMO 1 tag adicional (vegetariano, sem lactose)
- Evitar excesso de informações

## Meu Gosto

**Localização:** Dentro da Biblioteca (não há settings na Home)

**Estrutura:**

```
Meu Gosto

Alimentação
├─ Vegetariano/Vegano/Sem restrições
└─ Alergias (sem lactose, sem glúten...)

Objetivos (até 3 selecionados)
├─ Comer melhor
├─ Mais proteína
├─ Economizar
├─ Cozinhar rápido
└─ Experimentar coisas novas

Tempo disponível
├─ 10 min
├─ 20 min
├─ 30 min
└─ 45+ min

Rotina
├─ Pessoas que moram com você (1–5+)
├─ Hora que costuma preparar (café, almoço, café tarde, jantar)

Clima e região
├─ Sua cidade
└─ [toggle] Considerar clima em recomendações
```

**Visual:**
- Simples, editorial
- Sem cards pesados
- Sem formulários gigantes
- Cada linha é expansível (accordion simples)
- Mudanças salvam automaticamente

## Onboarding

### Princípio

Deve ser rápido (< 1 minuto) e não parecer "configuração de software".

Objetivo: coletar apenas o essencial para fazer a primeira sugestão útil.

**Máximo: 4 telas**

### Tela 1 — Alimentação

```
Como você costuma comer?

[ ] Sem restrições
[ ] Vegetariano
[ ] Vegano
[ ] Sem lactose
[ ] Sem glúten

━━━━━━━━━━━━━━━━

Tenho alergias ou
ingredientes a evitar

[campo de texto]
```

### Tela 2 — Objetivos

```
O que importa mais para você?

Selecionar até 3:

[ ] Comer melhor
[ ] Mais proteína
[ ] Economizar
[ ] Cozinhar rápido
[ ] Experimentar coisas novas

[Próximo]
```

### Tela 3 — Tempo

```
Quanto tempo você costuma ter
para preparar?

[ ] Até 10 min
[ ] 10–20 min
[ ] 20–30 min
[ ] 30–45 min
[ ] 45+ min

[Próximo]
```

### Tela 4 — Localização & Clima

```
Posso usar o clima da sua região
para melhorar as sugestões?

Sua cidade: [input com autocomplete]

[ ] Usar clima nas recomendações

[Começar]
```

**Background (opcional):** Silhueta extremamente discreta relacionada à cidade (nunca parecer turístico)

Exemplos:
- Berlim: Fernsehturm bem sutil no fundo
- Lisboa: horizon line abstrato
- Paris: silhueta sutil

**Regra:** Fundo não compete com conteúdo. Pareça atmosfera, não ilustração.

### Fluxo Pós-Onboarding

```
onboarding completo
↓ (nenhuma tela intermediária)
gera primeira sugestão automaticamente
↓
usuário entra na Home com receita sugerida
```

## Localização e Clima

### Localização

**Não exigir GPS preciso.**

Preferir:
- Autodetecção por IP (aprox. cidade)
- Ou input manual de cidade (autocomplete)

Guardar apenas: `{ city: string, country: string, timezone?: string }`

### Contexto Climático

Criar serviço desacoplado (não espalhar fetch de clima pelos componentes):

```ts
// services/weather.ts
interface WeatherContext {
  temperature: number;
  condition:
    | "clear"
    | "cloudy"
    | "rain"
    | "snow"
    | "storm";
  feelsLike?: number;
}

export async function getWeather(city: string): Promise<WeatherContext> {
  // Fetch de API (OpenWeatherMap, etc)
  // Retorna apenas o necessário
}
```

**Uso:** Provider no App Root que disponibiliza contexto globalmente

```tsx
<WeatherProvider>
  <Home />
</WeatherProvider>
```

### Variação Dinâmica

Home pode adaptar-se a:
- Hora do dia (receitas quentes no inverno, frias no verão)
- Clima (chuva → comfort food, sol → receitas frias)
- Temperatura

Tudo extremamente sutil — não criar ambiente temático óbvio.

## Motor de Recomendação

### Princípio

**Não usar machine learning no MVP.**

Implementar sistema **determinístico por scoring** com 3 camadas de contexto.

### Arquitetura de Scoring

```
┌─────────────────────────────────────┐
│ Restrições Obrigatórias (hardstop)  │
│ ✗ Alergia? → excluir completamente  │
│ ✗ Ingrediente proibido? → excluir    │
└─────────────────────────────────────┘
              ↓ (recipes válidas passam)
┌─────────────────────────────────────┐
│ Scoring Multicamada                 │
│ = layer1_score + layer2_score +     │
│   layer3_score + feedback_score     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Diversidade & Penalidades           │
│ - Penalizar receita recente         │
│ - Penalizar mesmo ingrediente       │
│ - Evitar culinária repetida         │
└─────────────────────────────────────┘
              ↓
       TOP 1 receita
```

### Camada 1 — Perfil (Longo Prazo)

Dados persistidos do usuário:

```ts
{
  dietaryPreferences: string[];      // vegetariano, vegano, etc
  excludedIngredients: string[];     // alimentos proibidos
  allergies: string[];               // alergias críticas
  goals: string[];                   // objetivos selecionados (até 3)
  usualPrepTime: number;             // tempo médio preferido (min)
  householdSize: number;             // quantas pessoas comem
  weatherEnabled: boolean;
  likedRecipes: RecipeId[];           // histórico de curtidas
  dislikedRecipes: RecipeId[];        // histórico de rejeições
  feedbackWeights: Map<RecipeId, number>;
}
```

**Impacto na recomendação:**
- Excluir receitas que violam alergias/excludedIngredients
- Favorecer receitas alinhadas com goals
- Usar preferências passadas como sinal fraco (não determinístico)

### Camada 2 — Contexto (Automático)

Varia sem ação do usuário:

```ts
{
  currentHour: number;        // 0–23
  dayOfWeek: number;          // 0–6
  season: string;             // "spring" | "summer" | "fall" | "winter"
  weatherCondition: string;   // "clear" | "cloudy" | "rain" | "snow"
  temperature: number;        // celsius
  timezone: string;
}
```

**Impacto:**
- Café da manhã (5–11h): favorecer `mealType: "breakfast"`
- Clima frio: aumentar `comfort` score
- Chuva: sugerir receitas reconfortantes
- Hora de pico (12–13h, 19–20h): favorecer rápidas

### Camada 3 — Intenção Atual (Temporária)

Ativa quando usuário clica em `Outra sugestão`:

```ts
{
  preference: "faster" | "lighter" | "comfort" | "surprise" | null;
  sessionStart: Date;
  expires: number; // duration em minutos
}
```

**Regra importante:**
- Esses valores **NÃO sobrescrevem** o perfil permanente
- Valem apenas até mudar de receita ou expirar
- Não influenciam feedback/histórico

### Fórmula de Score

```ts
finalScore =
  mealTimeScore(currentHour, mealType) +
  weatherScore(condition, temperature) +
  prepTimeScore(userPrefTime, recipeTime) +
  dietaryScore(userDiet, recipe.dietaryTags) +
  goalScore(userGoals, recipe.traits) +
  tasteScore(feedback.liked, feedback.disliked) +
  feedbackScore(recipe.feedbackWeights) +
  noveltyScore(recency, repetition) +
  intentionalPreferenceScore(currentIntention);

// Normalizar para escala 0–100
// Aplicar penalidades de diversidade
// Retornar top 1 receita com score > threshold
```

**Exemplo de pesos iniciais:**

| Sinal | Peso |
|-------|------|
| liked (perfil positivo) | +10 |
| disliked (perfil negativo) | -4 |
| ingrediente não curtido | -10 |
| tempo muito longo (vs pref) | -5 |
| muito pesado (vs objetivo leve) | -3 |
| mesma receita < 7 dias | -8 |
| mesmo ingrediente principal < 3 dias | -5 |
| mesma culinária 2x seguidas | -3 |

**Guardar em arquivo de config (não hardcoded):**

```ts
// config/recommendation-weights.ts
export const FEEDBACK_WEIGHTS = {
  liked: 10,
  disliked: -4,
  ingredientDislike: -10,
  // ...
};
```

### Diversidade

Evitar:
- Mesma receita em < 7 dias
- Mesmo ingrediente principal em < 3 dias
- Mesma culinária 2× seguidas
- Tudo muito similar (novidade importa)

Incluir receitas novas com probabilidade baixa mas consistente.

## Dados e Persistência

### Modelo de Receita

```ts
type Recipe = {
  id: string;
  slug: string;
  title: string;
  description: string;           // 1 frase curta, contextual
  imageUrl: string;
  prepTimeMinutes: number;
  servings: number;
  
  ingredients: {
    item: string;
    quantity: number;
    unit: string;
    optional?: boolean;
  }[];
  
  steps: {
    number: number;
    instruction: string;
  }[];
  
  mealTypes: ("breakfast" | "lunch" | "snack" | "dinner")[];
  dietaryTags: string[];         // "vegetarian", "vegan", "gluten-free"
  ingredientsTags: string[];     // "tomato", "chicken", "garlic"
  
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  
  traits: {
    comfort: number;        // 0–100 (comfort food vs light)
    lightness: number;      // 0–100 (heavy vs light)
    protein: number;        // 0–100 (high protein)
    cost: number;           // 0–100 (expensive vs budget)
    novelty: number;        // 0–100 (familiar vs new)
  };
  
  weatherAffinity: {
    hot: number;           // 0–100 (quente)
    mild: number;
    cold: number;          // 0–100 (receita quentinha)
    rainy: number;         // 0–100 (conforto/comfort)
  };
  
  palette: RecipePalette;
  active: boolean;
  createdAt: string;
};

type RecipePalette = {
  background: string;           // hex or rgb
  backgroundSecondary?: string; // para gradiente
  accent: string;
  accentStrong: string;         // cor do ícone biblioteca
  text: string;
  mutedText: string;
};
```

### Perfil do Usuário

```ts
type UserTasteProfile = {
  id: string;
  dietaryPreferences: string[];      // "vegetarian", "vegan", etc
  excludedIngredients: string[];     // "peanuts", "shellfish"
  allergies: string[];               // alergias críticas
  goals: string[];                   // até 3 (protéina, custo, rápido, etc)
  usualPrepTime: number | null;      // minutos
  householdSize: number;             // quantas pessoas
  city?: string;
  timezone?: string;
  weatherEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### Feedback e Histórico

```ts
type RecipeFeedback = {
  id: string;
  userId: string;
  recipeId: string;
  type: "liked" | "disliked";
  reason?: string;        // "too slow", "too heavy", "ingredients", "not now"
  contextSnapshot: {      // contexto no momento do feedback
    hour: number;
    dayOfWeek: number;
    weather?: string;
  };
  createdAt: string;
};

type RecommendationEvent = {
  id: string;
  userId: string;
  recipeId: string;
  eventType:
    | "recipe_shown"     // receita sugerida
    | "recipe_opened"    // usuário clicou "Ver receita"
    | "recipe_skipped"   // clicou "Outra sugestão"
    | "recipe_saved"     // clicou "Salvar"
    | "recipe_liked"     // clicou "Gostei"
    | "recipe_disliked"  // clicou "Não é pra mim"
    | "recipe_cooked";   // [futuro] marcou como preparada
  createdAt: string;
};
```

### Salvar Receita

**UI:**
```
Antes: [ Salvar receita ]
Após:  [ ✓ Salva ]
```

- Sem toast grande
- Feedback discreto (mudança de texto ou ícone)
- Não adicionar badge/contador no ícone da Biblioteca
- Transição suave (300ms)

**Dados:**
```ts
type SavedRecipe = {
  id: string;
  userId: string;
  recipeId: string;
  savedAt: string;
};
```

### Banco de Dados (Supabase/PostgreSQL)

```sql
-- Tabelas principais
tables/
  ├─ profiles (userId, nome, dados do onboarding)
  ├─ recipes (id, title, image, prep_time, traits, palette)
  ├─ recipe_ingredients (recipeId, item, quantity, unit)
  ├─ recipe_steps (recipeId, number, instruction)
  ├─ saved_recipes (userId, recipeId, savedAt)
  ├─ recipe_feedback (userId, recipeId, type, reason, context)
  └─ recommendation_events (userId, recipeId, eventType, createdAt)
```

**Índices importantes:**
- `saved_recipes(userId, savedAt)` — buscar receitas salvas
- `recipe_feedback(userId, createdAt)` — histórico de feedback
- `recommendation_events(userId, createdAt)` — eventos para analytics
- `recipes(active, id)` — listar receitas ativas

### RLS (Row Level Security)

```sql
-- Users só veem seus próprios dados
CREATE POLICY "Users can view own data"
  ON saved_recipes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert apenas do próprio usuário
CREATE POLICY "Users can insert own data"
  ON saved_recipes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## Persistência

Criar tabelas aproximadamente:

```txt
profiles
recipes
recipe_ingredients
saved_recipes
recipe_feedback
recommendation_events
```

## Recommendation Events

Registrar internamente:

```txt
recipe_shown
recipe_opened
recipe_skipped
recipe_saved
recipe_liked
recipe_disliked
recipe_cooked
```

No MVP, `recipe_cooked` pode ficar preparado para uso futuro.

## Acessibilidade, Performance e Privacidade

### Acessibilidade

**Garantir:**
- Navegação por teclado (tab, enter, escape)
- Foco visível em todos os elementos interativos
- Contraste >= 4.5:1 (WCAG AA)
- Área mínima de toque: 44×44px
- Semantic HTML (button, link, section, article)
- Labels acessíveis em inputs e botões
- Screen reader support (ARIA onde necessário)

**Preferências de movimento:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Em redução de movimento:
- Eliminar slides e translates
- Manter fades suaves (50–100ms)
- Preservar funcionalidade

### Performance

**Métricas alvo (Lighthouse):**
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

**Otimizações:**
- Next.js Image component (lazyload, responsive)
- Code splitting de componentes pesados
- Caching de receitas (ISR ou swr)
- Minificar CSS/JS

**Assets:**
- Imagens em WebP com fallback JPEG
- Ícones em SVG inline
- Fonts: variable font com subset

### Privacidade

**Coletar somente o necessário:**
- Não armazenar localização GPS precisa
- Apenas cidade (string)
- Sem dados de terceiros além de clima

**Transparência:**
- Usuário vê e edita preferências no "Meu Gosto"
- Feedback é editável/removível
- Histórico é consultável

**Conformidade:**
- LGPD (Brasil): política clara de dados
- Permitir export dos dados
- Permitir exclusão de conta (direito ao esquecimento)

## Responsividade

### Breakpoints Referenciais

```
mobile:  < 640px
tablet:  640px – 1024px
desktop: > 1024px
```

**Mas não ser rígido:**
- Usar `max-width` para ler fluido
- Media queries por funcionalidade, não tamanho
- Flexbox/grid adaptáveis

### Comportamentos por Tela

| Aspecto | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Home | Vertical stack | Stack com imagem maior | Split 40/60 |
| Biblioteca | Fullscreen slide | Fullscreen slide | Drawer 40vw |
| Buttons | 48–56px altura | 44px | 40–44px |
| Font size | 16px base | 16px | 16px |
| Container | Edge-to-edge | 90% | max-width 1200px |

## Arquitetura de Componentes

### Estrutura

```tsx
<App>
  ├─ <Providers>
  │  ├─ AuthProvider
  │  ├─ WeatherProvider
  │  └─ ThemeProvider
  ├─ <Layout>
  │  ├─ <Onboarding /> (se novo usuário)
  │  └─ <Home>
  │     ├─ <AtmosphereBackground />
  │     ├─ <LibraryButton />
  │     ├─ <RecipeSuggestion />
  │     │  ├─ <RecipeImage />
  │     │  ├─ <SuggestionContent />
  │     │  └─ <SuggestionActions />
  │     ├─ <RecipeDetails /> (conditional)
  │     ├─ <FeedbackButtons /> (conditional)
  │     ├─ <AlternativePrompt /> (conditional)
  │     └─ <LibraryDrawer />
  │        ├─ <SavedRecipes />
  │        └─ <TasteProfile />
```

### Princípios

- Componentes pequenos e focados
- Client Components somente para interatividade
- Server Components para dados estáticos
- Lógica de recomendação em services (não componentes)
- Estado mínimo em componentes
- Dados desacoplados da UI (usar context/providers)

### Sem abstrações prematuras

Não criar:
- Hooks customizados para tudo
- Camadas desnecessárias
- Configurações genéricas antes da necessidade

MVP deve ser direto e legível.

## Testes

### Unit Tests

**Foco:** Lógica de recomendação

```ts
tests/
  ├─ recommendation.test.ts
  │  ├─ scoring (mealTime, weather, prepTime)
  │  ├─ filtering (allergies, dietary)
  │  ├─ feedback weights
  │  ├─ diversity penalties
  │  └─ temp preferences
  └─ utils.test.ts
     ├─ context calculation
     └─ score normalization
```

**Exemplo:**

```ts
describe("Recommendation scoring", () => {
  it("excludes recipes with allergies", () => {
    const recipe = { ingredients: ["peanut", "wheat"] };
    const profile = { allergies: ["peanut"] };
    expect(isValidRecipe(recipe, profile)).toBe(false);
  });

  it("scores meal type correctly", () => {
    const score = mealTimeScore(12, "lunch"); // midday
    expect(score).toBeGreaterThan(
      mealTimeScore(12, "breakfast") // lunch > breakfast at noon
    );
  });
});
```

### E2E Tests

**Fluxo principal:**

```ts
describe("User journey", () => {
  it("completes onboarding", () => {
    // 1. Passa por 4 telas
    // 2. Chega na home com receita
  });

  it("opens recipe without page reload", () => {
    // 1. Clica "Ver receita"
    // 2. Imagem reduz + conteúdo aparece
    // 3. URL não muda
  });

  it("saves recipe", () => {
    // 1. Clica "Salvar"
    // 2. Texto muda para "Salva"
    // 3. Biblioteca reflete mudança
  });

  it("provides feedback", () => {
    // 1. Clica "Gostei" ou "Não é pra mim"
    // 2. Próxima sugestão respeita feedback
  });

  it("library opens and closes", () => {
    // 1. Clica ícone biblioteca
    // 2. Drawer abre
    // 3. Clica close, volta ao estado anterior
  });
});
```

**Tech:** Playwright ou Cypress, ambiente de teste com DB resetada

## Seed de Receitas

### Quantidade

30–50 receitas equilibradas

### Distribuição

```
Tipo de refeição:
  ├─ Café da manhã: 8–10
  ├─ Almoço: 12–15
  ├─ Lanche: 4–6
  └─ Jantar: 10–12

Características:
  ├─ Vegetariana: 12–15 (35%)
  ├─ Vegana: 6–8 (15%)
  ├─ Com carne: 12–15 (40%)
  └─ Sem lactose: 8–10

Tempo:
  ├─ Até 15 min (rápidas): 10–12
  ├─ 15–30 min: 12–15
  ├─ 30–45 min: 8–10
  └─ 45+ min: 4–6

Perfil:
  ├─ Comfort food: 8–10
  ├─ Leve: 8–10
  ├─ Alta proteína: 6–8
  ├─ Budget-friendly: 8–10
  └─ Gourmet/sofisticada: 4–6
```

### Dados Mínimos por Receita

```ts
{
  id: "unique-slug",
  title: "Nome da receita",
  description: "Uma frase contextual", // ex: "Quentinha e reconfortante"
  imageUrl: "https://...",
  prepTimeMinutes: 25,
  servings: 2,
  ingredients: [ /* ... */ ],
  steps: [ /* ... */ ],
  mealTypes: ["lunch"],
  dietaryTags: ["vegetarian"],
  traits: {
    comfort: 75,
    lightness: 40,
    protein: 60,
    cost: 30,
    novelty: 50
  },
  weatherAffinity: {
    hot: 20,
    mild: 60,
    cold: 80,
    rainy: 75
  },
  palette: { /* cores */ }
}
```

**O algoritmo depende desses dados** — sem metadata, recomendação falha.

## Implementação

### Restrições do MVP

**Não usar IA generativa no core:**
- Receitas são curadas, não geradas
- Sem adaptação dinâmica de ingredientes

**IA pode entrar depois para:**
- Sugestões de substituição
- Cálculo de porções
- Explicações de técnicas
- Chat conversacional
- Adaptar receitas a pantry do usuário

**O produto funciona perfeitamente sem IA.**

### Ordem de Implementação

#### Phase 1: Setup Fundacional

```
- Criar estrutura Next.js + TypeScript
- Design tokens (cores, tipografia, espaçamento)
- Types e interfaces centralizadas
- Seed inicial de receitas (30+)
- Home estática (sem interação)
```

**Entregável:** Home visualmente correta, sem animações

#### Phase 2: Estados e Motion

```
- State machine da Home
- Transições: sugestão → receita aberta
- Framer Motion integrado
- Responsividade (mobile, tablet, desktop)
- Alternancia entre receitas
```

**Entregável:** Home totalmente interativa no desktop e mobile

#### Phase 3: Biblioteca e Perfil

```
- Drawer da Biblioteca
- SavedRecipes list
- Meu Gosto (view e edit)
- Persistência em BD
```

**Entregável:** Usuário consegue salvar receitas e editar preferências

#### Phase 4: Onboarding

```
- 4 telas de onboarding
- Validação e salvamento
- Redirecionamento automático para Home
```

**Entregável:** Novo usuário completa onboarding em < 1 minuto

#### Phase 5: Motor de Recomendação v0.1

```
- Scoring determinístico
- Restrições de alergia/diet
- Hora do dia
- Feedback de curtir/rejeitar
```

**Entregável:** Recomendações começam a melhorar com histórico

#### Phase 6: Clima e Contexto

```
- Integração com API de clima
- Dynamic background
- Hora-based meal type
```

**Entregável:** Contexto ambiental influencia recomendações

#### Phase 7: Feedback e Ajustes

```
- "Gostei / Não é pra mim" com motivo
- Weights de feedback testados
- Penalidades de diversidade
```

**Entregável:** Algoritmo aprende com feedback

#### Phase 8: Polish, Testes e Deploy

```
- Unit tests (recommendation engine)
- E2E tests (critical paths)
- Accessibility audit
- Performance optimization
- Deploy em staging e produção
```

**Entregável:** MVP pronto para produção

### Critérios de Aceite — Home

- Abre com uma sugestão de receita
- Sem navbar ou sidebar
- Imagem é elemento dominante
- Duas ações claras: "Ver receita" e "Outra sugestão"
- Ícone Biblioteca discreto (top-right)
- Background adapta à paleta da receita
- Responsivo (mobile, tablet, desktop)

### Critérios de Aceite — Receita (Detalhe)

Ao clicar "Ver receita":
- ✓ Sem page reload (apenas reorganização)
- ✓ Imagem reduz e se move
- ✓ Conteúdo aparece com fade
- ✓ Desktop: layout 40/60
- ✓ Mobile: stack vertical com scroll
- ✓ "Salvar receita" funciona
- ✓ Feedback (Gostei/Não) funciona

### Critérios de Aceite — Outra Sugestão

- ✓ Usuário escolhe: Mais rápido / Leve / Confortante / Surpreenda-me
- ✓ Nova receita respeita a escolha
- ✓ Transição suave (300–600ms)
- ✓ Sem skeleton desnecessário

### Critérios de Aceite — Biblioteca

- ✓ Abre como drawer (desktop 40vw, mobile fullscreen)
- ✓ Fecha retornando ao estado anterior
- ✓ Mostra receitas salvas com imagem, nome, tempo
- ✓ Contém "Meu Gosto" para editar preferências
- ✓ Não parece dashboard (visual simples, editorial)

### Critérios de Aceite — Onboarding

- ✓ 4 telas no máximo
- ✓ Completável em < 1 minuto
- ✓ Sem tela intermediária após terminar
- ✓ Leva diretamente para Home com primeira sugestão

### Critérios de Aceite — Recomendação

**Hard stops:**
- Receita com alergia do usuário → excluída 100%
- Ingrediente proibido → excluído 100%

**Soft signals:**
- Hora do dia (breakfast vs lunch vs dinner)
- Clima (frio → comfort, chuva → confortante)
- Tempo disponível
- Objetivos do usuário
- Histórico de curtidas/rejeições
- Intenção atual (mais rápido, leve, etc)
- Diversidade (evitar repetição)

## Performance e Deployment

### Otimizações Críticas

**Imagens:**
- WebP com fallback JPEG
- Responsive `srcset` (mobile, tablet, desktop)
- Lazy loading com `<Image />` do Next.js
- Compression: TinyPNG ou similar

**Bundle:**
- Code-split componentes pesados (LibraryDrawer)
- Tree-shake dependências não usadas
- Minify + gzip automático com Vercel

**Caching:**
- ISR (Incremental Static Regeneration) para receitas estáticas
- SWR para dados mutáveis do usuário
- Browser cache com max-age headers

**Métrica alvo:**
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

### Deploy (Vercel recomendado)

```
Production: main branch (deploy automático)
Preview: PR branches (preview URLs)
Staging: staging branch (teste antes de main)
```

**Environment:**
- `.env.local` (desenvolvimento)
- `.env.production` (Vercel)
- Secrets: SUPABASE_URL, SUPABASE_KEY, WEATHER_API_KEY

**CI/CD:**
- Lint: ESLint + Prettier
- Type check: tsc
- Build test: `npm run build`
- E2E: Playwright em staging

### Monitoramento Pós-Launched

- Sentry (erro tracking)
- Vercel Analytics (Core Web Vitals)
- PostHog ou Plausible (analytics sem cookies)
- Supabase logs (API errors)

## Regra de Escopo

### O que pode entrar no MVP

- Home com sugestão contextual
- Visualização de receita (sem page reload)
- Onboarding rápido
- Biblioteca e Meu Gosto
- Motor básico de recomendação
- Feedback simples (Gostei/Não)
- Persistência de preferências e histórico

### O que explicitamente NÃO entra

❌ Navbar
❌ Busca global
❌ Feed de receitas
❌ Categorias navegáveis
❌ Gamificação (pontos, badges, ranks)
❌ Notificações
❌ Planos de refeição semanal
❌ Carrinho de compras
❌ Lista de compras
❌ Integração com supermercados
❌ IA generativa de receitas
❌ Compartilhamento social
❌ Comentários/reviews de usuários

**Regra:** Não adicionar features por iniciativa própria.
Se não está neste documento, não é MVP.

## Filosofia Final: "Mostra Pouco, Parece Inteligente"

O loop de valor que o MVP preserva:

```
┌─────────────────────────────────────┐
│ ABRIR APLICATIVO                    │
├─────────────────────────────────────┤
│ RECEBER UMA SUGESTÃO RELEVANTE      │
├─────────────────────────────────────┤
│ ACEITAR OU AJUSTAR (Outra sugestão) │
├─────────────────────────────────────┤
│ COZINHAR A RECEITA                  │
├─────────────────────────────────────┤
│ SALVAR OU DAR FEEDBACK              │
│ (Gostei / Não é pra mim / Salvar)   │
├─────────────────────────────────────┤
│ SISTEMA APRENDE, PRÓXIMA SUGESTÃO   │
│ MELHORA                             │
└─────────────────────────────────────┘
```

**Sucesso do MVP = usuário fecha dizendo:**

> "Como isso soube que era exatamente o que eu queria?"

Não há navbar, não há feed, não há "explore tudo".
Só há: **uma sugestão inteligente, feita para você, neste exato momento.**
