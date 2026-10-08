/** Catálogo determinístico do MockRecipeGenerationProvider. Formato idêntico ao esperado de um modelo real (§6). */
export type CatalogRecipe = {
  name: string; description: string; category: string; meal: "breakfast" | "lunch" | "dinner" | "snack";
  prep_time: number; cook_time: number; servings: number; difficulty: "easy" | "medium" | "hard";
  ingredients: { name: string; quantity: string; unit: string; note?: string }[];
  instructions: string[]; tags: string[];
};

const r = (x: CatalogRecipe) => x;

export const MOCK_CATALOG: CatalogRecipe[] = [
  r({ name: "Macarrão Alho e Óleo com Tomate-cereja", description: "Clássico rápido, perfumado de alho e com tomates que estouram na panela.", category: "Massas", meal: "dinner", prep_time: 5, cook_time: 15, servings: 2, difficulty: "easy",
    ingredients: [{ name: "Massa", quantity: "200", unit: "g" }, { name: "Alho", quantity: "4", unit: "dentes" }, { name: "Tomate-cereja", quantity: "150", unit: "g" }, { name: "Azeite de oliva", quantity: "3", unit: "colheres de sopa" }, { name: "Sal", quantity: "a gosto", unit: "" }],
    instructions: ["Cozinhe a massa em água salgada até ficar al dente.", "Doure o alho fatiado no azeite em fogo baixo.", "Junte os tomates e deixe estourarem por 5 minutos.", "Misture a massa ao molho com um pouco da água do cozimento."], tags: ["rápido", "vegetariano"] }),
  r({ name: "Frango Grelhado com Limão e Alecrim", description: "Peito de frango suculento, com casquinha dourada e aroma de ervas.", category: "Jantar", meal: "dinner", prep_time: 10, cook_time: 15, servings: 2, difficulty: "easy",
    ingredients: [{ name: "Peito de frango", quantity: "400", unit: "g" }, { name: "Limão", quantity: "1", unit: "un" }, { name: "Alecrim", quantity: "2", unit: "ramos" }, { name: "Alho", quantity: "2", unit: "dentes" }, { name: "Sal", quantity: "a gosto", unit: "" }],
    instructions: ["Tempere o frango com limão, alho, alecrim e sal por 10 minutos.", "Grelhe em frigideira quente por 6 minutos de cada lado.", "Deixe descansar 3 minutos antes de fatiar."], tags: ["proteico"] }),
  r({ name: "Sopa de Abóbora com Gengibre", description: "Cremosa, doce na medida e com um toque picante.", category: "Sopas", meal: "dinner", prep_time: 10, cook_time: 25, servings: 4, difficulty: "easy",
    ingredients: [{ name: "Abóbora", quantity: "500", unit: "g" }, { name: "Cebola", quantity: "1", unit: "un" }, { name: "Gengibre", quantity: "1", unit: "colher de chá" }, { name: "Caldo de legumes", quantity: "600", unit: "ml" }, { name: "Sal", quantity: "a gosto", unit: "" }],
    instructions: ["Refogue a cebola e o gengibre.", "Junte a abóbora em cubos e o caldo; cozinhe por 20 minutos.", "Bata no liquidificador até ficar cremoso e acerte o sal."], tags: ["confortável", "vegano"] }),
  r({ name: "Omelete de Ovos com Queijo e Ervas", description: "Fofinha, com queijo derretido e ervas frescas.", category: "Café da manhã", meal: "breakfast", prep_time: 3, cook_time: 5, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Ovos", quantity: "3", unit: "un" }, { name: "Queijo", quantity: "40", unit: "g" }, { name: "Cebolinha", quantity: "1", unit: "colher de sopa" }, { name: "Sal", quantity: "a gosto", unit: "" }],
    instructions: ["Bata os ovos com sal.", "Frite em fogo médio, junte o queijo e as ervas.", "Dobre ao meio e sirva quente."], tags: ["rápido", "proteico"] }),
  r({ name: "Omelete Simples de Ovos", description: "Três ovos e uma frigideira.", category: "Café da manhã", meal: "breakfast", prep_time: 2, cook_time: 5, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Ovos", quantity: "3", unit: "un" }, { name: "Sal", quantity: "a gosto", unit: "" }],
    instructions: ["Bata os ovos com sal.", "Frite em fogo médio e dobre ao meio."], tags: ["rápido"] }), // quase-duplicata do seed: exercita a detecção
  r({ name: "Salada de Grão-de-bico com Pepino", description: "Fresca, crocante e saciante.", category: "Saladas", meal: "lunch", prep_time: 12, cook_time: 0, servings: 2, difficulty: "easy",
    ingredients: [{ name: "Grão-de-bico", quantity: "1", unit: "lata" }, { name: "Pepino", quantity: "1", unit: "un" }, { name: "Cebola roxa", quantity: "1/2", unit: "un" }, { name: "Limão", quantity: "1", unit: "un" }, { name: "Azeite de oliva", quantity: "2", unit: "colheres de sopa" }],
    instructions: ["Escorra e lave o grão-de-bico.", "Corte o pepino e a cebola em cubos pequenos.", "Misture tudo com limão, azeite e sal."], tags: ["fresco", "vegano"] }),
  r({ name: "Arroz de Forno com Legumes", description: "Prático e completo: vai ao forno e cuida de si mesmo.", category: "Almoço", meal: "lunch", prep_time: 15, cook_time: 35, servings: 4, difficulty: "medium",
    ingredients: [{ name: "Arroz cozido", quantity: "3", unit: "xícaras" }, { name: "Cenoura", quantity: "1", unit: "un" }, { name: "Abobrinha", quantity: "1", unit: "un" }, { name: "Queijo", quantity: "100", unit: "g" }, { name: "Molho de tomate", quantity: "1", unit: "xícara" }],
    instructions: ["Refogue os legumes cortados em cubos.", "Misture ao arroz e ao molho.", "Cubra com queijo e leve ao forno a 200°C por 20 minutos."], tags: ["forno", "família"] }),
  r({ name: "Panqueca de Banana e Aveia", description: "Sem farinha branca, doce só da banana.", category: "Café da manhã", meal: "breakfast", prep_time: 5, cook_time: 10, servings: 2, difficulty: "easy",
    ingredients: [{ name: "Banana", quantity: "2", unit: "un" }, { name: "Aveia", quantity: "4", unit: "colheres de sopa" }, { name: "Ovos", quantity: "2", unit: "un" }, { name: "Canela", quantity: "1", unit: "pitada" }],
    instructions: ["Amasse as bananas e misture com os ovos e a aveia.", "Doure colheradas da massa em frigideira antiaderente.", "Sirva com canela."], tags: ["rápido", "leve"] }),
  r({ name: "Risoto de Cogumelos", description: "Cremoso, com cogumelos dourados e parmesão.", category: "Jantar", meal: "dinner", prep_time: 10, cook_time: 30, servings: 3, difficulty: "hard",
    ingredients: [{ name: "Arroz arbóreo", quantity: "1", unit: "xícara" }, { name: "Cogumelos", quantity: "250", unit: "g" }, { name: "Cebola", quantity: "1", unit: "un" }, { name: "Caldo de legumes", quantity: "1", unit: "litro" }, { name: "Parmesão", quantity: "40", unit: "g" }],
    instructions: ["Doure os cogumelos e reserve.", "Refogue a cebola e o arroz.", "Adicione o caldo aos poucos, mexendo, por 20 minutos.", "Finalize com cogumelos e parmesão."], tags: ["confortável"] }),
  r({ name: "Wrap de Atum com Folhas", description: "Lanche fresco, pronto em minutos.", category: "Lanche", meal: "snack", prep_time: 8, cook_time: 0, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Atum em lata", quantity: "1", unit: "lata" }, { name: "Tortilla", quantity: "1", unit: "un" }, { name: "Alface", quantity: "3", unit: "folhas" }, { name: "Tomate", quantity: "1/2", unit: "un" }],
    instructions: ["Escorra o atum e tempere com limão.", "Monte sobre a tortilla com as folhas e o tomate.", "Enrole firme e corte ao meio."], tags: ["rápido"] }),
  r({ name: "Curry de Grão-de-bico e Espinafre", description: "Especiado, cremoso e reconfortante.", category: "Jantar", meal: "dinner", prep_time: 10, cook_time: 20, servings: 3, difficulty: "medium",
    ingredients: [{ name: "Grão-de-bico", quantity: "2", unit: "xícaras" }, { name: "Espinafre", quantity: "2", unit: "punhados" }, { name: "Leite de coco", quantity: "200", unit: "ml" }, { name: "Cebola", quantity: "1", unit: "un" }, { name: "Curry em pó", quantity: "1", unit: "colher de sopa" }],
    instructions: ["Refogue a cebola com o curry.", "Junte o grão-de-bico e o leite de coco; cozinhe por 12 minutos.", "Acrescente o espinafre no final."], tags: ["vegano", "especiado"] }),
  r({ name: "Iogurte com Frutas e Granola", description: "Café da manhã sem fogo.", category: "Café da manhã", meal: "breakfast", prep_time: 4, cook_time: 0, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Iogurte natural", quantity: "1", unit: "pote" }, { name: "Morango", quantity: "5", unit: "un" }, { name: "Granola", quantity: "3", unit: "colheres de sopa" }, { name: "Mel", quantity: "1", unit: "colher de chá" }],
    instructions: ["Monte o iogurte em uma tigela.", "Cubra com frutas fatiadas e granola.", "Finalize com mel."], tags: ["rápido", "leve"] }),
  r({ name: "Peixe ao Forno com Batatas", description: "Um tabuleiro, pouco esforço, jantar completo.", category: "Jantar", meal: "dinner", prep_time: 10, cook_time: 30, servings: 2, difficulty: "medium",
    ingredients: [{ name: "Filé de peixe branco", quantity: "2", unit: "un" }, { name: "Batata", quantity: "3", unit: "un" }, { name: "Limão", quantity: "1", unit: "un" }, { name: "Azeite de oliva", quantity: "3", unit: "colheres de sopa" }, { name: "Salsinha", quantity: "1", unit: "punhado" }],
    instructions: ["Asse as batatas em rodelas por 15 minutos a 200°C.", "Acomode o peixe temperado com limão e azeite por cima.", "Leve ao forno por mais 12 minutos e finalize com salsinha."], tags: ["forno"] }),
  r({ name: "Tapioca de Queijo e Tomate", description: "Crocante por fora, macia por dentro.", category: "Lanche", meal: "snack", prep_time: 3, cook_time: 3, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Goma de tapioca", quantity: "3", unit: "colheres de sopa" }, { name: "Queijo", quantity: "40", unit: "g" }, { name: "Tomate", quantity: "1/2", unit: "un" }],
    instructions: ["Espalhe a goma em frigideira quente.", "Quando firmar, recheie com queijo e tomate.", "Dobre e sirva."], tags: ["rápido", "sem glúten"] }),
  r({ name: "Strogonoff de Cogumelos", description: "Versão vegetariana do clássico, cremosa e rápida.", category: "Almoço", meal: "lunch", prep_time: 10, cook_time: 15, servings: 3, difficulty: "easy",
    ingredients: [{ name: "Cogumelos", quantity: "300", unit: "g" }, { name: "Cebola", quantity: "1", unit: "un" }, { name: "Creme de leite", quantity: "1", unit: "caixinha" }, { name: "Molho de tomate", quantity: "3", unit: "colheres de sopa" }],
    instructions: ["Doure os cogumelos com a cebola.", "Junte o molho de tomate e o creme de leite.", "Cozinhe por 5 minutos e sirva com arroz."], tags: ["vegetariano"] }),
  r({ name: "Bolo de Caneca de Cacau", description: "Sobremesa individual em 2 minutos de micro-ondas.", category: "Sobremesa", meal: "snack", prep_time: 5, cook_time: 2, servings: 1, difficulty: "easy",
    ingredients: [{ name: "Farinha de trigo", quantity: "4", unit: "colheres de sopa" }, { name: "Cacau em pó", quantity: "2", unit: "colheres de sopa" }, { name: "Ovos", quantity: "1", unit: "un" }, { name: "Leite", quantity: "3", unit: "colheres de sopa" }, { name: "Açúcar", quantity: "2", unit: "colheres de sopa" }],
    instructions: ["Misture tudo direto na caneca.", "Leve ao micro-ondas por 90 segundos a 2 minutos.", "Deixe esfriar um minuto antes de comer."], tags: ["doce", "rápido"] }),
  r({ name: "Tabule de Quinoa", description: "Fresco, cítrico e cheio de ervas.", category: "Saladas", meal: "lunch", prep_time: 15, cook_time: 12, servings: 3, difficulty: "easy",
    ingredients: [{ name: "Quinoa", quantity: "1", unit: "xícara" }, { name: "Tomate", quantity: "2", unit: "un" }, { name: "Pepino", quantity: "1", unit: "un" }, { name: "Hortelã", quantity: "1", unit: "punhado" }, { name: "Limão", quantity: "2", unit: "un" }],
    instructions: ["Cozinhe a quinoa e deixe esfriar.", "Pique tomate, pepino e hortelã.", "Misture tudo com limão e azeite."], tags: ["fresco", "vegano"] }),
  r({ name: "Panqueca de Espinafre e Ricota", description: "Recheio leve para o jantar de dia de semana.", category: "Jantar", meal: "dinner", prep_time: 15, cook_time: 15, servings: 3, difficulty: "medium",
    ingredients: [{ name: "Farinha de trigo", quantity: "1", unit: "xícara" }, { name: "Leite", quantity: "1", unit: "xícara" }, { name: "Ovos", quantity: "1", unit: "un" }, { name: "Espinafre", quantity: "2", unit: "punhados" }, { name: "Ricota", quantity: "200", unit: "g" }],
    instructions: ["Bata a massa e faça os discos em frigideira.", "Refogue o espinafre e misture à ricota.", "Recheie, enrole e gratine por 10 minutos."], tags: ["família"] }),
];
