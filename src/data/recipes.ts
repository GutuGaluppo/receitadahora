import type { MealType, Recipe } from "@/types";
import { PALETTES, type PaletteName } from "./palettes";

/** Fotos recortadas disponíveis em /public/recipes. As demais usam a ilustração gerada. */
const IMAGES: Record<string, string> = {
  "pasta-cremosa-abobora": "/recipes/pasta-cremosa-abobora.webp",
};

type Ing = [item: string, quantity: number, unit: string, optional?: boolean];

type Seed = {
  id: string;
  title: string;
  description: string;
  time: number;
  servings: number;
  cuisine: string;
  meals: MealType[];
  diet: string[];
  /** Primeira tag = ingrediente principal. */
  tags: string[];
  ing: Ing[];
  steps: string[];
  /** comfort, lightness, protein, cost, novelty */
  traits: [number, number, number, number, number];
  /** hot, mild, cold, rainy */
  weather: [number, number, number, number];
  pal: PaletteName;
  kcal?: number;
};

const SMALL = new Set(["de", "da", "do", "das", "dos", "e", "com", "ao", "à", "na", "no", "em", "para", "ou"]);

/** "Pasta cremosa de abóbora" → "Pasta Cremosa de Abóbora" (padrão editorial das telas). */
function titleCase(t: string): string {
  return t
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function build(s: Seed): Recipe {
  return {
    id: s.id,
    slug: s.id,
    title: titleCase(s.title),
    description: s.description,
    imageUrl: IMAGES[s.id] ?? "",
    prepTimeMinutes: s.time,
    servings: s.servings,
    cuisine: s.cuisine,
    ingredients: s.ing.map(([item, quantity, unit, optional]) => ({ item, quantity, unit, ...(optional ? { optional } : {}) })),
    steps: s.steps.map((instruction, i) => ({ number: i + 1, instruction })),
    mealTypes: s.meals,
    dietaryTags: s.diet,
    ingredientsTags: s.tags,
    nutrition: s.kcal ? { calories: s.kcal } : undefined,
    traits: {
      comfort: s.traits[0],
      lightness: s.traits[1],
      protein: s.traits[2],
      cost: s.traits[3],
      novelty: s.traits[4],
    },
    weatherAffinity: { hot: s.weather[0], mild: s.weather[1], cold: s.weather[2], rainy: s.weather[3] },
    palette: PALETTES[s.pal],
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const V = "vegetarian";
const VG = "vegan";
const LF = "lactose-free";
const GF = "gluten-free";

const seeds: Seed[] = [
  /* ───────── Café da manhã ───────── */
  {
    id: "panqueca-banana-aveia", title: "Panqueca de banana e aveia", description: "Macia, sem açúcar, pronta antes do café esfriar.",
    time: 12, servings: 2, cuisine: "brasileira", meals: ["breakfast"], diet: [V, LF], tags: ["banana", "aveia", "ovo"], kcal: 290,
    ing: [["Banana madura", 2, "un"], ["Aveia em flocos", 6, "colheres de sopa"], ["Ovo", 2, "un"], ["Canela", 1, "pitada"], ["Óleo de coco", 1, "colher de chá"]],
    steps: ["Amasse as bananas com um garfo até virar um purê.", "Misture os ovos, a aveia e a canela até ficar homogêneo.", "Aqueça uma frigideira antiaderente com um fio de óleo de coco.", "Despeje porções pequenas e doure 2 minutos de cada lado. Sirva morna."],
    traits: [55, 65, 40, 20, 25], weather: [55, 70, 55, 55], pal: "morning",
  },
  {
    id: "tapioca-queijo-coco", title: "Tapioca de queijo e coco", description: "Crocante por fora, macia por dentro. Leve e rápida.",
    time: 8, servings: 1, cuisine: "brasileira", meals: ["breakfast", "snack"], diet: [V, GF], tags: ["tapioca", "queijo", "coco", "leite"], kcal: 260,
    ing: [["Goma de tapioca", 4, "colheres de sopa"], ["Queijo minas", 40, "g"], ["Coco ralado", 1, "colher de sopa"]],
    steps: ["Aqueça uma frigideira antiaderente em fogo médio, sem óleo.", "Espalhe a goma peneirada formando um disco fino.", "Quando a goma ligar, adicione o queijo e o coco em metade do disco.", "Dobre ao meio, deixe 30 segundos e sirva."],
    traits: [40, 70, 25, 25, 30], weather: [70, 70, 40, 40], pal: "morning",
  },
  {
    id: "omelete-ervas", title: "Omelete de ervas frescas", description: "Proteína de verdade, sem pressa e sem louça demais.",
    time: 10, servings: 1, cuisine: "francesa", meals: ["breakfast", "lunch"], diet: [V, GF, LF], tags: ["ovo", "ervas", "cebolinha"], kcal: 230,
    ing: [["Ovo", 3, "un"], ["Cebolinha", 2, "colheres de sopa"], ["Salsinha", 1, "colher de sopa"], ["Azeite", 1, "colher de chá"], ["Sal", 1, "pitada"]],
    steps: ["Bata os ovos com sal e as ervas picadas.", "Aqueça o azeite numa frigideira pequena em fogo médio-baixo.", "Despeje os ovos e, conforme firmarem, leve as bordas para o centro.", "Quando estiver quase firme, dobre ao meio e sirva."],
    traits: [40, 75, 85, 20, 30], weather: [65, 70, 50, 45], pal: "fresh",
  },
  {
    id: "mingau-aveia-maca", title: "Mingau de aveia com maçã e canela", description: "Quentinho, simples e abraça por dentro.",
    time: 10, servings: 1, cuisine: "internacional", meals: ["breakfast"], diet: [VG, LF], tags: ["aveia", "maçã", "canela"], kcal: 280,
    ing: [["Aveia em flocos", 4, "colheres de sopa"], ["Bebida vegetal", 250, "ml"], ["Maçã", 1, "un"], ["Canela em pó", 1, "colher de chá"], ["Mel ou agave", 1, "colher de chá", ]],
    steps: ["Leve a aveia e a bebida vegetal ao fogo baixo, mexendo sempre.", "Corte a maçã em cubos pequenos e junte ao mingau.", "Cozinhe 5 minutos até engrossar.", "Finalize com canela e um fio de mel."],
    traits: [85, 60, 25, 15, 20], weather: [10, 45, 90, 85], pal: "warm",
  },
  {
    id: "torrada-abacate-ovo", title: "Torrada de abacate com ovo", description: "Cremosa, crocante e com ovo mole por cima.",
    time: 10, servings: 1, cuisine: "internacional", meals: ["breakfast", "snack"], diet: [V, LF], tags: ["abacate", "pão", "ovo", "trigo", "gluten"], kcal: 340,
    ing: [["Pão integral", 2, "fatias"], ["Abacate", 0.5, "un"], ["Ovo", 1, "un"], ["Limão", 0.5, "un"], ["Pimenta calabresa", 1, "pitada"]],
    steps: ["Toste o pão até dourar.", "Amasse o abacate com limão e uma pitada de sal.", "Cozinhe o ovo por 6 minutos em água fervente e descasque.", "Espalhe o abacate nas torradas, coroe com o ovo e a pimenta."],
    traits: [45, 70, 45, 45, 35], weather: [65, 75, 45, 45], pal: "fresh",
  },
  {
    id: "iogurte-frutas-granola", title: "Iogurte com frutas e granola", description: "Fresco, crocante e pronto em dois minutos.",
    time: 3, servings: 1, cuisine: "internacional", meals: ["breakfast", "snack"], diet: [V], tags: ["iogurte", "granola", "frutas", "leite", "aveia"], kcal: 260,
    ing: [["Iogurte natural", 170, "g"], ["Morangos ou manga", 1, "xícara"], ["Granola", 3, "colheres de sopa"], ["Mel", 1, "colher de chá"]],
    steps: ["Coloque o iogurte numa tigela.", "Corte as frutas e distribua por cima.", "Finalize com granola e um fio de mel na hora de comer."],
    traits: [20, 85, 35, 30, 10], weather: [95, 70, 15, 10], pal: "berry",
  },
  {
    id: "smoothie-bowl-cacau", title: "Smoothie bowl de banana e cacau", description: "Gelado, doce na medida, com crocante por cima.",
    time: 7, servings: 1, cuisine: "internacional", meals: ["breakfast", "snack"], diet: [VG, GF, LF], tags: ["banana", "cacau", "amendoim"], kcal: 310,
    ing: [["Banana congelada", 2, "un"], ["Cacau em pó", 1, "colher de sopa"], ["Pasta de amendoim", 1, "colher de sopa"], ["Bebida vegetal", 80, "ml"], ["Nibs de cacau", 1, "colher de sopa", ]],
    steps: ["Bata no liquidificador a banana congelada, o cacau e a bebida vegetal até ficar cremoso.", "Adicione a pasta de amendoim e pulse rapidamente.", "Transfira para uma tigela e finalize com os nibs."],
    traits: [50, 70, 30, 40, 55], weather: [100, 65, 10, 5], pal: "berry",
  },
  {
    id: "cuscuz-ovo", title: "Cuscuz com ovo e manteiga", description: "Café da manhã nordestino: simples, firme e saboroso.",
    time: 15, servings: 2, cuisine: "brasileira", meals: ["breakfast", "dinner"], diet: [V, GF], tags: ["milho", "ovo", "manteiga", "leite"], kcal: 330,
    ing: [["Flocão de milho", 1, "xícara"], ["Água morna", 0.75, "xícara"], ["Ovo", 2, "un"], ["Manteiga", 1, "colher de sopa"], ["Sal", 1, "pitada"]],
    steps: ["Hidrate o flocão com água morna e sal por 5 minutos.", "Cozinhe no vapor por 8 minutos até ficar macio.", "Frite os ovos na manteiga.", "Sirva o cuscuz com o ovo por cima."],
    traits: [75, 55, 45, 10, 20], weather: [30, 65, 80, 70], pal: "earth",
  },

  /* ───────── Almoço / jantar ───────── */
  {
    id: "pasta-cremosa-abobora", title: "Pasta cremosa de abóbora", description: "Quente, cremosa e reconfortante para uma noite fria.",
    time: 25, servings: 2, cuisine: "italiana", meals: ["lunch", "dinner"], diet: [V], tags: ["abóbora", "massa", "pimentão", "trigo", "gluten", "leite"], kcal: 340,
    ing: [["Massa", 250, "g"], ["Abóbora", 300, "g"], ["Pimentão vermelho", 1, "un"], ["Alho", 1, "dente"], ["Creme de leite (ou alternativa vegetal)", 100, "ml"], ["Parmesão", 0, "a gosto"], ["Azeite de oliva", 0, "a gosto"], ["Sal e pimenta", 0, "a gosto"], ["Folhas de sálvia", 0, "a gosto", true]],
    steps: ["Asse a abóbora e o pimentão até ficarem macios.", "Bata com o alho, o creme de leite, azeite, sal e pimenta até formar um molho cremoso.", "Cozinhe a massa conforme as instruções da embalagem.", "Misture a massa ao molho e finalize com parmesão e sálvia."],
    traits: [90, 40, 25, 30, 35], weather: [10, 50, 90, 90], pal: "warm",
  },
  {
    id: "salada-grao-de-bico", title: "Salada fresca de grão-de-bico", description: "Crocante, cítrica e leve, sem acender o fogão.",
    time: 10, servings: 2, cuisine: "mediterrânea", meals: ["lunch"], diet: [VG, GF, LF], tags: ["grão-de-bico", "pepino", "tomate", "limão"], kcal: 290,
    ing: [["Grão-de-bico cozido", 1, "xícara"], ["Pepino", 1, "un"], ["Tomate", 2, "un"], ["Cebola roxa", 0.5, "un"], ["Limão", 1, "un"], ["Azeite", 2, "colheres de sopa"]],
    steps: ["Escorra e lave o grão-de-bico.", "Corte pepino, tomate e cebola em cubos pequenos.", "Misture tudo com o suco do limão, o azeite e sal.", "Deixe descansar 5 minutos e sirva gelada."],
    traits: [15, 95, 45, 25, 25], weather: [100, 70, 10, 5], pal: "fresh",
  },
  {
    id: "frango-grelhado-legumes", title: "Frango grelhado com legumes assados", description: "Proteína de verdade e um prato que se resolve sozinho no forno.",
    time: 35, servings: 2, cuisine: "brasileira", meals: ["lunch", "dinner"], diet: [GF, LF], tags: ["frango", "abobrinha", "cenoura", "carne"], kcal: 380,
    ing: [["Peito de frango", 300, "g"], ["Abobrinha", 1, "un"], ["Cenoura", 2, "un"], ["Alho", 2, "dentes"], ["Azeite", 2, "colheres de sopa"], ["Limão", 1, "un"]],
    steps: ["Tempere o frango com alho, limão e sal por 10 minutos.", "Corte os legumes em palitos grossos, regue com azeite e leve ao forno a 220 °C por 20 minutos.", "Grelhe o frango em frigideira bem quente, 5 minutos de cada lado.", "Deixe o frango descansar 3 minutos, fatie e sirva com os legumes."],
    traits: [45, 70, 90, 40, 15], weather: [55, 75, 55, 45], pal: "earth",
  },
  {
    id: "arroz-feijao-ovo", title: "Arroz, feijão e ovo frito", description: "O clássico que nunca erra e custa quase nada.",
    time: 20, servings: 2, cuisine: "brasileira", meals: ["lunch", "dinner"], diet: [V, GF, LF], tags: ["arroz", "feijão", "ovo"], kcal: 520,
    ing: [["Arroz cozido", 2, "xícaras"], ["Feijão cozido com caldo", 1.5, "xícaras"], ["Ovo", 2, "un"], ["Alho", 1, "dente"], ["Couve", 3, "folhas"]],
    steps: ["Aqueça o feijão com o alho dourado em um fio de óleo.", "Fatie a couve bem fina e refogue por 1 minuto.", "Frite os ovos mantendo a gema mole.", "Monte o prato com arroz, feijão, couve e o ovo por cima."],
    traits: [80, 45, 55, 5, 5], weather: [40, 70, 75, 65], pal: "earth",
  },
  {
    id: "curry-grao-de-bico-coco", title: "Curry de grão-de-bico e leite de coco", description: "Rico, perfumado e com calor na medida.",
    time: 30, servings: 3, cuisine: "indiana", meals: ["lunch", "dinner"], diet: [VG, GF, LF], tags: ["grão-de-bico", "coco", "tomate", "curry"], kcal: 410,
    ing: [["Grão-de-bico cozido", 2, "xícaras"], ["Leite de coco", 200, "ml"], ["Tomate picado", 2, "un"], ["Cebola", 1, "un"], ["Curry em pó", 2, "colheres de chá"], ["Gengibre ralado", 1, "colher de chá"]],
    steps: ["Refogue a cebola e o gengibre até ficarem macios.", "Junte o curry e o tomate e cozinhe 5 minutos até formar um molho.", "Adicione o grão-de-bico e o leite de coco.", "Cozinhe em fogo baixo por 10 minutos. Sirva com arroz ou pão."],
    traits: [85, 45, 45, 25, 65], weather: [25, 55, 85, 80], pal: "saffron",
  },
  {
    id: "risoto-cogumelos", title: "Risoto de cogumelos", description: "Demora um pouco, mas cada colherada compensa.",
    time: 40, servings: 2, cuisine: "italiana", meals: ["lunch", "dinner"], diet: [V, GF], tags: ["arroz", "cogumelo", "queijo", "leite", "manteiga"], kcal: 450,
    ing: [["Arroz arbóreo", 1, "xícara"], ["Cogumelos frescos", 250, "g"], ["Caldo de legumes quente", 800, "ml"], ["Cebola", 0.5, "un"], ["Parmesão ralado", 3, "colheres de sopa"], ["Manteiga", 1, "colher de sopa"]],
    steps: ["Salteie os cogumelos fatiados em fogo alto até dourarem e reserve.", "Refogue a cebola na manteiga, junte o arroz e mexa por 1 minuto.", "Adicione o caldo aos poucos, mexendo, por cerca de 20 minutos.", "Misture os cogumelos, o parmesão e finalize com pimenta-do-reino."],
    traits: [90, 30, 30, 55, 40], weather: [5, 40, 95, 90], pal: "cozy",
  },
  {
    id: "wrap-frango-abacate", title: "Wrap de frango e abacate", description: "Prático para comer em pé ou na mesa de trabalho.",
    time: 15, servings: 1, cuisine: "internacional", meals: ["lunch", "snack"], diet: [LF], tags: ["frango", "abacate", "trigo", "gluten", "carne"], kcal: 430,
    ing: [["Tortilha de trigo", 1, "un"], ["Frango desfiado", 100, "g"], ["Abacate", 0.5, "un"], ["Alface", 3, "folhas"], ["Limão", 0.5, "un"]],
    steps: ["Amasse o abacate com limão e sal.", "Aqueça a tortilha por 20 segundos de cada lado.", "Espalhe o abacate, distribua o frango e a alface.", "Enrole bem firme e corte ao meio."],
    traits: [40, 70, 75, 45, 25], weather: [80, 70, 30, 30], pal: "fresh",
  },
  {
    id: "bowl-quinoa-legumes", title: "Bowl de quinoa e legumes assados", description: "Colorido, saciante e quase sem esforço.",
    time: 35, servings: 2, cuisine: "internacional", meals: ["lunch", "dinner"], diet: [VG, GF, LF], tags: ["quinoa", "batata-doce", "brócolis", "grão-de-bico"], kcal: 390,
    ing: [["Quinoa", 1, "xícara"], ["Batata-doce", 1, "un"], ["Brócolis", 1, "cabeça pequena"], ["Grão-de-bico cozido", 1, "xícara"], ["Azeite", 2, "colheres de sopa"], ["Tahine", 1, "colher de sopa"]],
    steps: ["Cozinhe a quinoa em duas partes de água por 15 minutos.", "Corte a batata-doce e o brócolis, tempere com azeite e asse a 220 °C por 20 minutos junto com o grão-de-bico.", "Dilua o tahine com limão e água para fazer o molho.", "Monte o bowl e finalize com o molho."],
    traits: [50, 80, 55, 50, 50], weather: [60, 80, 50, 40], pal: "fresh",
  },
  {
    id: "macarrao-alho-oleo", title: "Macarrão de alho e óleo", description: "Dez minutos, três ingredientes, zero desculpas.",
    time: 12, servings: 2, cuisine: "italiana", meals: ["lunch", "dinner"], diet: [VG, LF], tags: ["massa", "alho", "trigo", "gluten"], kcal: 480,
    ing: [["Espaguete", 200, "g"], ["Alho", 4, "dentes"], ["Azeite", 4, "colheres de sopa"], ["Pimenta calabresa", 1, "pitada"], ["Salsinha", 2, "colheres de sopa"]],
    steps: ["Cozinhe o espaguete em água salgada e guarde uma xícara da água do cozimento.", "Doure o alho fatiado no azeite em fogo baixo, sem queimar.", "Junte o macarrão, a pimenta e um pouco da água do cozimento.", "Misture bem e finalize com salsinha."],
    traits: [75, 40, 20, 5, 10], weather: [40, 70, 65, 60], pal: "tomato",
  },
  {
    id: "tilapia-limao-batata", title: "Tilápia assada com limão e batatas", description: "Leve, aromática e vai sozinha ao forno.",
    time: 40, servings: 2, cuisine: "mediterrânea", meals: ["lunch", "dinner"], diet: [GF, LF], tags: ["peixe", "batata", "limão"], kcal: 360,
    ing: [["Filé de tilápia", 300, "g"], ["Batata", 3, "un"], ["Limão siciliano", 1, "un"], ["Alecrim", 2, "ramos"], ["Azeite", 3, "colheres de sopa"]],
    steps: ["Corte as batatas em rodelas finas e asse com azeite e sal a 200 °C por 15 minutos.", "Tempere o peixe com limão, sal e alecrim.", "Coloque o peixe sobre as batatas e asse por mais 15 minutos.", "Finalize com raspas de limão e um fio de azeite."],
    traits: [40, 80, 85, 45, 35], weather: [65, 80, 40, 35], pal: "sea",
  },

  /* ───────── Jantares e sopas ───────── */
  {
    id: "sopa-lentilha", title: "Sopa de lentilha com legumes", description: "Uma panela, pouco custo, e a casa inteira esquenta.",
    time: 35, servings: 3, cuisine: "mediterrânea", meals: ["dinner", "lunch"], diet: [VG, GF, LF], tags: ["lentilha", "cenoura", "cebola"], kcal: 300,
    ing: [["Lentilha", 1, "xícara"], ["Cenoura", 2, "un"], ["Cebola", 1, "un"], ["Alho", 2, "dentes"], ["Caldo de legumes", 1, "litro"], ["Cominho", 1, "colher de chá"]],
    steps: ["Refogue cebola e alho em azeite; junte a cenoura em cubos e o cominho.", "Adicione a lentilha lavada e o caldo.", "Cozinhe em fogo médio por 25 minutos até a lentilha ficar macia.", "Amasse levemente com uma colher e finalize com limão."],
    traits: [90, 55, 50, 5, 25], weather: [5, 40, 95, 95], pal: "cozy",
  },
  {
    id: "caldo-verde", title: "Caldo verde", description: "Clássico português que aquece até o último gole.",
    time: 40, servings: 4, cuisine: "portuguesa", meals: ["dinner"], diet: [GF, LF], tags: ["batata", "couve", "linguiça", "carne"], kcal: 320,
    ing: [["Batata", 4, "un"], ["Couve", 6, "folhas"], ["Linguiça calabresa", 150, "g"], ["Cebola", 1, "un"], ["Alho", 2, "dentes"], ["Água", 1.2, "litro"]],
    steps: ["Refogue a cebola e o alho; junte as batatas em cubos e a água.", "Cozinhe por 20 minutos até desmancharem, e bata no liquidificador.", "Fatie a couve bem fininha e a linguiça em rodelas; doure a linguiça.", "Volte o creme ao fogo, junte a couve e a linguiça e ferva por 3 minutos."],
    traits: [95, 35, 45, 20, 30], weather: [0, 35, 100, 95], pal: "cozy",
  },
  {
    id: "strogonoff-cogumelos", title: "Strogonoff de cogumelos", description: "Todo o conforto do clássico, sem carne.",
    time: 25, servings: 2, cuisine: "russa", meals: ["dinner", "lunch"], diet: [V], tags: ["cogumelo", "creme de leite", "leite", "tomate"], kcal: 390,
    ing: [["Cogumelos variados", 400, "g"], ["Cebola", 1, "un"], ["Molho de tomate", 3, "colheres de sopa"], ["Creme de leite", 200, "g"], ["Mostarda", 1, "colher de chá"], ["Arroz", 1, "xícara"]],
    steps: ["Salteie os cogumelos em fogo alto até dourarem e reserve.", "Refogue a cebola, junte o molho de tomate e a mostarda.", "Volte os cogumelos e adicione o creme de leite.", "Aqueça sem ferver e sirva com arroz."],
    traits: [90, 35, 30, 40, 30], weather: [10, 45, 90, 85], pal: "tomato",
  },
  {
    id: "sopa-abobora-gengibre", title: "Sopa de abóbora com gengibre", description: "Aveludada, com um calorzinho que vem do gengibre.",
    time: 30, servings: 3, cuisine: "internacional", meals: ["dinner"], diet: [VG, GF, LF], tags: ["abóbora", "gengibre", "cebola"], kcal: 210,
    ing: [["Abóbora", 600, "g"], ["Cebola", 1, "un"], ["Gengibre", 2, "cm"], ["Caldo de legumes", 700, "ml"], ["Leite de coco", 100, "ml"]],
    steps: ["Refogue a cebola e o gengibre ralado em azeite.", "Junte a abóbora em cubos e o caldo, cozinhe 20 minutos.", "Bata até ficar liso e volte à panela.", "Misture o leite de coco e acerte o sal."],
    traits: [85, 60, 15, 10, 30], weather: [5, 40, 95, 95], pal: "warm",
  },
  {
    id: "escondidinho-carne-seca", title: "Escondidinho de carne seca", description: "Domingo na mesa: purê macio por cima, sabor profundo por baixo.",
    time: 55, servings: 4, cuisine: "brasileira", meals: ["lunch", "dinner"], diet: [GF], tags: ["carne", "mandioca", "queijo", "leite"], kcal: 520,
    ing: [["Carne seca dessalgada e desfiada", 300, "g"], ["Mandioca", 700, "g"], ["Cebola", 1, "un"], ["Leite", 100, "ml"], ["Queijo coalho ralado", 100, "g"], ["Manteiga", 2, "colheres de sopa"]],
    steps: ["Cozinhe a mandioca até desmanchar, amasse com o leite e a manteiga.", "Refogue a cebola e a carne seca desfiada até dourar.", "Monte em camadas: carne no fundo, purê por cima.", "Cubra com queijo e leve ao forno a 200 °C até gratinar."],
    traits: [100, 20, 70, 50, 20], weather: [0, 25, 100, 90], pal: "earth",
  },
  {
    id: "tacos-feijao-preto", title: "Tacos de feijão-preto e abacate", description: "Prático, colorido e com um toque de limão.",
    time: 20, servings: 2, cuisine: "mexicana", meals: ["dinner", "lunch"], diet: [VG, LF], tags: ["feijão", "abacate", "milho", "tortilha"], kcal: 400,
    ing: [["Feijão-preto cozido", 1, "xícara"], ["Tortilhas de milho", 4, "un"], ["Abacate", 1, "un"], ["Tomate", 1, "un"], ["Coentro", 2, "colheres de sopa"], ["Limão", 1, "un"]],
    steps: ["Amasse parcialmente o feijão e tempere com cominho e sal.", "Faça um guacamole simples: abacate, limão, sal e coentro.", "Corte o tomate em cubos pequenos.", "Aqueça as tortilhas, monte os tacos e sirva com limão."],
    traits: [60, 60, 40, 25, 55], weather: [75, 75, 35, 30], pal: "tomato",
  },
  {
    id: "lasanha-berinjela", title: "Lasanha de berinjela", description: "Sem massa, com todo o molho e o queijo derretido.",
    time: 50, servings: 4, cuisine: "italiana", meals: ["dinner"], diet: [V, GF], tags: ["berinjela", "queijo", "tomate", "leite"], kcal: 360,
    ing: [["Berinjela", 3, "un"], ["Molho de tomate", 400, "g"], ["Muçarela", 200, "g"], ["Ricota", 150, "g"], ["Manjericão", 1, "punhado"]],
    steps: ["Corte a berinjela em fatias longas, salgue e deixe 10 minutos; seque bem.", "Grelhe ou asse as fatias até dourarem.", "Monte camadas de berinjela, molho, ricota e muçarela.", "Asse a 200 °C por 25 minutos e finalize com manjericão."],
    traits: [80, 45, 45, 45, 40], weather: [15, 55, 85, 75], pal: "tomato",
  },
  {
    id: "espaguete-camarao-alho", title: "Espaguete com camarão e alho", description: "Elegante, rápido e com cheiro de restaurante.",
    time: 20, servings: 2, cuisine: "italiana", meals: ["dinner", "lunch"], diet: [LF], tags: ["camarão", "massa", "alho", "trigo", "gluten", "frutos do mar"], kcal: 470,
    ing: [["Espaguete", 200, "g"], ["Camarão limpo", 250, "g"], ["Alho", 4, "dentes"], ["Azeite", 3, "colheres de sopa"], ["Limão", 1, "un"], ["Salsinha", 2, "colheres de sopa"]],
    steps: ["Cozinhe o espaguete e guarde um pouco da água.", "Doure o alho no azeite e junte os camarões; cozinhe 2 minutos de cada lado.", "Misture a massa, um pouco da água e o suco do limão.", "Finalize com salsinha."],
    traits: [55, 60, 80, 85, 60], weather: [60, 80, 50, 40], pal: "sea",
  },
  {
    id: "moqueca-peixe", title: "Moqueca de peixe", description: "Capixaba, aromática e perfeita para dividir.",
    time: 40, servings: 3, cuisine: "brasileira", meals: ["lunch", "dinner"], diet: [GF, LF], tags: ["peixe", "coco", "tomate", "pimentão"], kcal: 430,
    ing: [["Posta de peixe branco", 500, "g"], ["Leite de coco", 200, "ml"], ["Tomate", 2, "un"], ["Pimentão", 1, "un"], ["Cebola", 1, "un"], ["Coentro", 3, "colheres de sopa"]],
    steps: ["Tempere o peixe com limão e sal por 15 minutos.", "Monte camadas de cebola, tomate e pimentão numa panela larga.", "Disponha o peixe, regue com leite de coco e azeite de dendê, se gostar.", "Cozinhe tampado 15 minutos sem mexer, e finalize com coentro."],
    traits: [75, 55, 85, 65, 50], weather: [45, 80, 65, 70], pal: "saffron",
  },
  {
    id: "panqueca-espinafre-ricota", title: "Panqueca de espinafre e ricota", description: "Recheio leve, massa fininha, tudo coberto de molho.",
    time: 35, servings: 3, cuisine: "italiana", meals: ["dinner", "lunch"], diet: [V], tags: ["espinafre", "ricota", "ovo", "leite", "trigo", "gluten"], kcal: 330,
    ing: [["Farinha de trigo", 1, "xícara"], ["Leite", 1, "xícara"], ["Ovo", 2, "un"], ["Espinafre refogado", 1, "xícara"], ["Ricota", 200, "g"], ["Molho de tomate", 300, "g"]],
    steps: ["Bata farinha, leite e ovos até virar uma massa lisa.", "Faça as panquecas em frigideira untada, finas e douradas.", "Misture o espinafre com a ricota e recheie as panquecas.", "Arrume em um refratário, cubra com molho e aqueça no forno por 10 minutos."],
    traits: [75, 50, 45, 30, 20], weather: [20, 60, 85, 75], pal: "fresh",
  },
  {
    id: "ensopado-carne-legumes", title: "Ensopado de carne com legumes", description: "Cozinha devagar e rende mais do que parece.",
    time: 70, servings: 4, cuisine: "brasileira", meals: ["dinner", "lunch"], diet: [GF, LF], tags: ["carne", "batata", "cenoura", "mandioca"], kcal: 460,
    ing: [["Acém em cubos", 500, "g"], ["Batata", 2, "un"], ["Cenoura", 2, "un"], ["Cebola", 1, "un"], ["Extrato de tomate", 1, "colher de sopa"], ["Água", 700, "ml"]],
    steps: ["Doure a carne em panela quente, em lotes.", "Refogue a cebola, junte o extrato de tomate e volte a carne.", "Cubra com água e cozinhe tampado por 40 minutos.", "Adicione batata e cenoura e cozinhe mais 20 minutos, até tudo ficar macio."],
    traits: [100, 25, 80, 55, 15], weather: [0, 25, 100, 95], pal: "cozy",
  },
  {
    id: "yakisoba-legumes", title: "Yakisoba de legumes", description: "Salteado e vivo, pronto na velocidade da frigideira.",
    time: 25, servings: 2, cuisine: "japonesa", meals: ["dinner", "lunch"], diet: [VG, LF], tags: ["macarrão", "repolho", "cenoura", "soja", "trigo", "gluten"], kcal: 380,
    ing: [["Macarrão para yakisoba", 250, "g"], ["Repolho", 2, "xícaras"], ["Cenoura", 1, "un"], ["Brócolis", 1, "xícara"], ["Shoyu", 3, "colheres de sopa"], ["Óleo de gergelim", 1, "colher de chá"]],
    steps: ["Corte os legumes em tiras finas.", "Cozinhe o macarrão conforme a embalagem e escorra.", "Salteie os legumes em fogo alto por 3 minutos.", "Junte o macarrão e o shoyu, misture e finalize com gergelim."],
    traits: [55, 65, 25, 25, 55], weather: [55, 75, 55, 50], pal: "night",
  },
  {
    id: "frango-curry-arroz", title: "Frango ao curry com arroz", description: "Doce e picante, com molho para o arroz inteiro.",
    time: 30, servings: 2, cuisine: "indiana", meals: ["dinner", "lunch"], diet: [GF, LF], tags: ["frango", "curry", "coco", "carne"], kcal: 520,
    ing: [["Peito de frango em cubos", 350, "g"], ["Cebola", 1, "un"], ["Curry em pó", 2, "colheres de chá"], ["Leite de coco", 150, "ml"], ["Arroz cozido", 2, "xícaras"]],
    steps: ["Doure o frango em fogo alto.", "Junte a cebola picada e o curry e refogue por 2 minutos.", "Adicione o leite de coco e cozinhe 10 minutos.", "Sirva com arroz."],
    traits: [85, 40, 90, 45, 50], weather: [25, 60, 85, 80], pal: "saffron",
  },

  /* ───────── Lanches ───────── */
  {
    id: "bolo-caneca-chocolate", title: "Bolo de caneca de chocolate", description: "Pra quando bate a vontade — pronto em 3 minutos.",
    time: 5, servings: 1, cuisine: "internacional", meals: ["snack"], diet: [V], tags: ["chocolate", "ovo", "farinha", "trigo", "gluten", "leite"], kcal: 360,
    ing: [["Farinha de trigo", 3, "colheres de sopa"], ["Cacau em pó", 2, "colheres de sopa"], ["Ovo", 1, "un"], ["Leite", 3, "colheres de sopa"], ["Açúcar", 2, "colheres de sopa"], ["Óleo", 1, "colher de sopa"]],
    steps: ["Misture os secos numa caneca grande.", "Junte ovo, leite e óleo e mexa até ficar liso.", "Leve ao micro-ondas por 1 minuto e 30 segundos.", "Espere 1 minuto antes de comer."],
    traits: [95, 20, 20, 15, 15], weather: [20, 55, 90, 85], pal: "earth",
  },
  {
    id: "homus-crudites", title: "Homus com palitos de legumes", description: "Cremoso, crocante e saciante, sem fogo.",
    time: 10, servings: 2, cuisine: "mediterrânea", meals: ["snack"], diet: [VG, GF, LF], tags: ["grão-de-bico", "tahine", "cenoura", "pepino"], kcal: 220,
    ing: [["Grão-de-bico cozido", 1, "xícara"], ["Tahine", 2, "colheres de sopa"], ["Limão", 1, "un"], ["Alho", 1, "dente"], ["Cenoura e pepino", 2, "un"]],
    steps: ["Bata o grão-de-bico com tahine, limão, alho e um pouco de água até ficar cremoso.", "Acerte o sal e regue com azeite.", "Corte a cenoura e o pepino em palitos.", "Sirva para mergulhar."],
    traits: [25, 90, 40, 25, 45], weather: [85, 75, 20, 15], pal: "fresh",
  },
  {
    id: "queijo-coalho-mel", title: "Queijo coalho grelhado com mel", description: "Salgado, doce e quentinho. Um lanche de beira de praia.",
    time: 8, servings: 2, cuisine: "brasileira", meals: ["snack"], diet: [V, GF], tags: ["queijo", "leite", "mel"], kcal: 250,
    ing: [["Queijo coalho em espetos", 4, "un"], ["Mel", 2, "colheres de sopa"], ["Orégano", 1, "pitada"]],
    steps: ["Aqueça uma chapa ou frigideira antiaderente.", "Grelhe os espetos até dourarem dos dois lados.", "Regue com mel e polvilhe o orégano."],
    traits: [60, 40, 50, 35, 20], weather: [65, 70, 50, 45], pal: "morning",
  },
  {
    id: "cookie-aveia-banana", title: "Cookie de aveia e banana", description: "Dois ingredientes, assa em 12 minutos e perfuma a casa.",
    time: 20, servings: 4, cuisine: "internacional", meals: ["snack", "breakfast"], diet: [VG, LF], tags: ["banana", "aveia", "chocolate"], kcal: 120,
    ing: [["Banana madura", 2, "un"], ["Aveia em flocos", 1, "xícara"], ["Gotas de chocolate", 3, "colheres de sopa", ]],
    steps: ["Amasse as bananas e misture com a aveia e o chocolate.", "Modele bolinhas achatadas numa assadeira forrada.", "Asse a 180 °C por 12 minutos, até firmar.", "Deixe esfriar para ficarem crocantes."],
    traits: [60, 60, 15, 10, 20], weather: [40, 70, 65, 60], pal: "morning",
  },
];

export const RECIPES: Recipe[] = seeds.map(build);

export const RECIPES_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));
