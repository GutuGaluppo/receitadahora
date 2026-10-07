# Recipe Photography System v0.1
## Receita da Hora

Este sistema define o padrão visual oficial para todas as imagens de receitas do **Receita da Hora**.

O objetivo é simples: cada receita pode ser diferente, mas todas devem parecer pertencer ao mesmo universo visual.

---

## 1. Princípio central

A fotografia deve transmitir:

**apetite + conforto + elegância + simplicidade**

A imagem não deve parecer:

- fotografia de stock genérica;
- foto de restaurante sofisticado demais;
- conteúdo de influencer;
- imagem excessivamente perfeita ou artificial;
- cenário de cozinha cheio de objetos.

A imagem deve parecer uma **fotografia editorial gastronômica criada exclusivamente para o Receita da Hora**.

---

## 2. DNA visual

Elementos constantes:

- fundo quente em creme, bege ou areia;
- iluminação suave e difusa;
- prato como protagonista absoluto;
- composição limpa;
- profundidade de campo rasa;
- cores naturais, levemente intensificadas;
- ingredientes principais visíveis;
- alguns elementos do prato podem aparecer ao redor;
- sensação de movimento sutil;
- atmosfera acolhedora;
- acabamento editorial premium.

Paleta visual dominante:

- cream
- warm beige
- sand
- terracotta
- pumpkin orange
- olive green
- deep herb green
- natural food tones

Evitar fundos frios, azulados ou excessivamente brancos.

---

## 3. Composição

### Hero image

O prato ocupa aproximadamente:

**55–70% da área visual**

Preferência por:

- bowl;
- prato baixo;
- prato cerâmico;
- travessa discreta.

O recipiente deve ser:

- branco quebrado;
- creme;
- bege;
- cerâmica natural;
- ocasionalmente verde suave ou terracota muito discreta.

Evitar louça muito estampada.

### Enquadramento

Preferência:

**3/4 superior levemente inclinado**

Algo entre fotografia frontal e top-down.

Não usar top-down absoluto como padrão.

Isso ajuda a mostrar:

- volume;
- textura;
- ingredientes;
- molho;
- profundidade.

---

## 4. Fundo

O padrão oficial é:

**fundo neutro quente com textura visual mínima**

Pode incluir:

- superfície fosca;
- textura de pedra suave;
- cerâmica;
- papel;
- madeira muito clara;
- gradiente natural produzido pela luz.

Não usar:

- cozinha completa;
- mesas muito decoradas;
- pessoas;
- mãos;
- restaurantes;
- toalhas chamativas;
- cenas domésticas complexas.

O fundo existe para valorizar o prato.

---

## 5. Iluminação

Direção preferida:

**soft natural side light**

A luz deve parecer vir de uma janela grande.

Características:

- sombras suaves;
- highlights delicados;
- contraste moderado;
- temperatura quente;
- sem luz dura.

Evitar:

- flash;
- sombras muito marcadas;
- iluminação dramática;
- HDR excessivo.

---

## 6. Ingredientes ao redor

Uma das assinaturas do Receita da Hora pode ser o uso de ingredientes ao redor do prato.

Eles podem aparecer:

- sobre a superfície;
- levemente desfocados;
- suspensos;
- caindo;
- próximos ao prato.

Exemplos:

- folhas de sálvia;
- parmesão;
- pimenta;
- ervas;
- sementes;
- raspas;
- pequenos pedaços dos ingredientes principais.

Mas há uma regra importante:

> Todo ingrediente mostrado deve existir na receita.

Nada deve ser adicionado apenas por estética.

---

## 7. Movimento visual

Pode haver pequenos elementos suspensos.

Exemplo:

- ervas;
- queijo;
- sementes;
- crumbs;
- especiarias.

O movimento deve ser discreto.

Nunca transformar a imagem em uma explosão de ingredientes.

Regra:

**máximo de 3–6 elementos em suspensão claramente perceptíveis.**

---

## 8. Realismo

A comida deve parecer:

**possível de cozinhar em casa.**

Isso é muito importante para o posicionamento do produto.

A imagem não deve parecer:

- prato de restaurante Michelin;
- montagem impossível;
- comida excessivamente perfeita;
- CGI evidente.

Pequenas imperfeições são desejáveis.

Exemplos:

- molho levemente irregular;
- ervas fora do centro;
- pedaços com tamanhos diferentes;
- queijo espalhado naturalmente.

---

## 9. Fidelidade à receita

Essa é uma regra estrutural.

A imagem deve representar a receita real.

O gerador só pode utilizar ingredientes presentes em:

```ts
visualIngredients[]
```

Exemplo:

```ts
visualIngredients: [
  "pumpkin",
  "sage",
  "parmesan",
  "black pepper"
]
```

A geração não deve inventar:

```txt
tomato
basil
mushrooms
egg
parsley
cream garnish
```

se eles não fizerem parte da receita.

---

## 10. Tipos de pratos

A composição pode se adaptar à categoria.

### Pasta

Preferência:

- bowl baixo;
- noodles visíveis;
- molho perceptível;
- toppings naturais.

### Soup

Preferência:

- bowl profundo;
- superfície parcialmente visível;
- textura perceptível;
- garnish mínimo.

### Salad

Preferência:

- bowl largo;
- ingredientes claramente identificáveis;
- maior presença de verdes.

### Curry

Preferência:

- bowl profundo;
- molho abundante;
- ingredientes parcialmente emergindo.

### Breakfast

Pode usar:

- prato;
- bowl;
- small plate.

Adicionar elementos apenas quando fizerem sentido.

### Sandwich / Burger

Preferência:

- enquadramento lateral 3/4;
- foco nas camadas.

### Dessert

Pode haver iluminação um pouco mais suave e delicada.

Ainda assim deve respeitar o mesmo universo visual.

---

## 11. Sazonalidade

A imagem pode comunicar estação de maneira sutil.

### Outono

- laranja;
- terracota;
- castanhos suaves;
- luz quente.

### Inverno

- creme;
- âmbar;
- tons aconchegantes;
- pratos mais densos.

### Primavera

- verdes claros;
- ervas;
- fundos ligeiramente mais claros.

### Verão

- maior luminosidade;
- cores frescas;
- sensação mais leve.

A identidade principal nunca muda.

---

## 12. Formato master

Cada receita deve possuir uma imagem principal:

```txt
recipe-master
```

Formato recomendado:

**2048 × 1536 px**

Aspect ratio:

**4:3**

Esse será o arquivo original.

A partir dele serão derivados os demais formatos.

---

## 13. Derivados oficiais

### Hero Desktop

```txt
1600 × 1000
16:10
```

Uso:

- homepage;
- recommendation screen;
- desktop recipe hero.

### Hero Mobile

```txt
1200 × 1500
4:5
```

Uso:

- mobile recommendation;
- recipe page.

### Card

```txt
800 × 800
1:1
```

Uso:

- biblioteca;
- grids;
- sugestões.

### Thumbnail

```txt
320 × 320
1:1
```

Uso:

- listas;
- histórico;
- favoritos.

---

## 14. Safe area

O prato principal deve permanecer dentro da zona central:

```txt
70% central da imagem
```

Isso permite cortar:

```txt
4:3
16:10
4:5
1:1
```

sem destruir a composição.

Ingredientes decorativos podem ocupar áreas periféricas.

---

## 15. Prompt oficial

Estrutura base:

```text
Premium editorial food photography for the Receita da Hora recipe app.

Dish:
{{dishName}}

Description:
{{visualDescription}}

Main visible ingredients:
{{visualIngredients}}

Presentation:
{{presentation}}

Seasonal mood:
{{seasonalMood}}

Create a realistic homemade dish presented beautifully but naturally.

Visual identity:
warm cream and beige background,
soft natural side lighting,
subtle shallow depth of field,
premium editorial food photography,
minimal composition,
natural ceramic tableware,
warm earthy color palette,
highly appetizing but believable,
clean background,
soft shadows.

The dish must be the visual protagonist.

Include only ingredients that are part of the recipe.

A few ingredients may appear naturally around the dish or subtly suspended in the scene.

Avoid excessive styling.

The food should look achievable in a normal home kitchen.

No people.
No hands.
No text.
No kitchen environment.
No table clutter.
No cutlery unless necessary.
No ingredients not listed in the recipe.
No unrealistic garnishes.
No excessive CGI appearance.
No stock photography look.

Composition must support cropping to:
4:3,
16:10,
4:5,
1:1.
```

---

## 16. Variáveis

Estrutura recomendada:

```ts
type RecipeImagePrompt = {
  dishName: string
  visualDescription: string
  visualIngredients: string[]
  presentation: string
  seasonalMood?: string
  mealType: string
}
```

Exemplo:

```ts
{
  dishName: "Pasta Cremosa de Abóbora",

  visualDescription:
    "creamy ribbon pasta coated in roasted pumpkin sauce",

  visualIngredients: [
    "roasted pumpkin",
    "parmesan",
    "sage",
    "black pepper"
  ],

  presentation:
    "served in a shallow warm-white ceramic bowl",

  seasonalMood:
    "cozy autumn evening",

  mealType:
    "dinner"
}
```

---

## 17. Negative prompt conceitual

O sistema deve evitar:

```text
people
hands
cutlery clutter
restaurant scene
busy kitchen
table decorations
flowers
random garnish
ingredients not present in recipe
extreme saturation
plastic-looking food
unrealistic food
perfect symmetry
dark dramatic lighting
hard shadows
flash photography
stock photography
overhead flat lay
text
logos
watermarks
```

---

## 18. Controle de qualidade

Antes de uma imagem entrar na biblioteca, validar:

### Receita

- ingredientes correspondem;
- apresentação faz sentido;
- quantidade visual é plausível.

### Imagem

- prato claramente identificável;
- fundo correto;
- cores dentro da identidade;
- sem elementos estranhos;
- sem mãos;
- sem texto;
- sem utensílios aleatórios.

### Crop

Validar:

- desktop hero;
- mobile hero;
- card;
- thumbnail.

Se o prato desaparecer ou ficar cortado demais em algum deles, a imagem deve ser rejeitada.

---

## 19. Cloudflare R2

Estrutura sugerida:

```txt
recipes/
  pasta-cremosa-de-abobora/
    master.webp
    hero-desktop.webp
    hero-mobile.webp
    card.webp
    thumb.webp
```

Ou usando ID:

```txt
recipes/
  rec_01K7P...
    master.webp
    hero-desktop.webp
    hero-mobile.webp
    card.webp
    thumb.webp
```

Preferência: usar ID.

O ID evita problemas caso o nome da receita mude.

---

## 20. Formato de arquivo

Preferência:

**WebP**

Fallback futuro:

**AVIF**

Pipeline:

```txt
generated PNG/JPEG
      ↓
master.webp
      ↓
resize/crop
      ↓
hero-desktop.webp
hero-mobile.webp
card.webp
thumb.webp
```

---

## 21. Qualidade

Sugestão inicial:

```txt
master        WebP 90
hero desktop  WebP 86
hero mobile   WebP 86
card          WebP 82
thumb         WebP 78
```

Podemos calibrar depois olhando peso versus qualidade real.

---

## 22. Dados armazenados na receita

Sugestão:

```ts
type RecipeImages = {
  master: string
  heroDesktop: string
  heroMobile: string
  card: string
  thumbnail: string
  alt: string

  generation?: {
    promptVersion: string
    generatedAt: string
    approved: boolean
  }
}
```

Exemplo:

```json
{
  "images": {
    "master": "https://images.receitadahora.app/recipes/rec_123/master.webp",
    "heroDesktop": "https://images.receitadahora.app/recipes/rec_123/hero-desktop.webp",
    "heroMobile": "https://images.receitadahora.app/recipes/rec_123/hero-mobile.webp",
    "card": "https://images.receitadahora.app/recipes/rec_123/card.webp",
    "thumbnail": "https://images.receitadahora.app/recipes/rec_123/thumb.webp",
    "alt": "Pasta cremosa de abóbora com parmesão e folhas de sálvia."
  }
}
```

---

## 23. Pipeline ideal

```txt
Criar receita
     ↓
Definir visualIngredients
     ↓
Gerar prompt
     ↓
Gerar master image
     ↓
Validar imagem
     ↓
Criar crops
     ↓
Converter WebP
     ↓
Upload Cloudflare R2
     ↓
Salvar URLs
     ↓
Publicar receita
```

---

## 24. Automação futura

Quando o pipeline estiver maduro, podemos chegar a:

```txt
recipe.json
     ↓
image prompt generator
     ↓
image generation
     ↓
visual validation
     ↓
Sharp
     ↓
R2
     ↓
database
```

Onde `Sharp` cria automaticamente:

```txt
hero desktop
hero mobile
card
thumbnail
```

sem intervenção manual.

---

## 25. Assinatura visual do Receita da Hora

Há um detalhe das imagens que já criamos que deve ser mantido como assinatura do produto:

> **ingredientes e pequenas partículas orbitando discretamente o prato.**

É distintivo sem ser espalhafatoso.

Pode virar um elemento reconhecível tanto na fotografia quanto na própria interface.

O prato parece estar em um pequeno **momento suspenso**.

Isso combina muito bem com a ideia do produto:

> **a receita certa para aquele momento.**

E cria uma ponte interessante entre **produto, marca e fotografia**.

---

## Regra final

Mesmo com centenas ou milhares de pratos diferentes, alguém deveria conseguir olhar uma imagem isolada e pensar:

**“isso parece uma receita do Receita da Hora.”**
