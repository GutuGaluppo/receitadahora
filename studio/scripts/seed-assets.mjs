// Popula os estados do Studio pelo fluxo real da API (upload → R2 → D1). Rode depois de `db:seed:local`.
import { api, upload } from "./lib.mjs";

const need = async (p, label) => { const r = await p; if (!r.ok) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.json)}`); return r; };
const ing = (slug) => `/api/ingredients/ingredient_seed_${slug}`;

const approved = { abacate: [112, 150, 60], ovo: [245, 230, 190], pao: [200, 150, 90], limao: [235, 220, 80], massa: [235, 205, 120], abobora: [225, 130, 40], sal: [235, 235, 235], aveia: [215, 190, 150], leite: [245, 245, 240], canela: [150, 85, 50] };
for (const [slug, rgb] of Object.entries(approved)) {
  await need(upload(`${ing(slug)}/asset`, rgb, `${slug}.png`, { approve: "true" }), `upload ${slug}`);
}
// em revisão / rejeitado / sem imagem (pimenta, grão-de-bico, pepino, tahine ficam sem imagem)
await need(upload(`${ing("pimentao")}/asset`, [200, 40, 40], "pimentao.png"), "pimentao");
await need(upload(`${ing("alho")}/asset`, [240, 235, 225], "alho.png"), "alho");
await need(api(`${ing("alho")}/asset/reject`, { method: "POST", body: { reason: "Fundo escuro demais" } }), "reject alho");

const hero = (n, rgb) => upload(`/api/recipes/recipe_seed_${n}/hero`, rgb, `hero-${n}.png`);
await need(hero(1, [220, 190, 130]), "hero 1");           // torrada: imagem em revisão, pimenta sem asset
await need(hero(2, [235, 170, 90]), "hero 2");            // massa: aprovada
await need(api("/api/recipes/recipe_seed_2/hero/approve", { method: "POST" }), "approve hero 2");
await need(hero(4, [240, 225, 150]), "hero 4");           // omelete: tudo pronto → publicada
await need(api("/api/recipes/recipe_seed_4/hero/approve", { method: "POST" }), "approve hero 4");
await need(hero(5, [225, 200, 160]), "hero 5");           // mingau: em revisão

await need(api("/api/recipes/recipe_seed_4/approve", { method: "POST" }), "approve recipe 4");
await need(api("/api/recipes/recipe_seed_4/publish", { method: "POST" }), "publish recipe 4");

// receita rejeitada (com motivo), criada pelo mesmo caminho da UI
const rej = await need(api("/api/recipes", { method: "POST", body: {
  name: "Panqueca de Aveia", category: "Café da manhã", prep_time: 5, cook_time: 8, servings: 2, batch_id: "batch_seed_001", force_duplicate: true,
  description: "Rápida e sem açúcar.", instructions: ["Misture tudo.", "Doure na frigideira."],
  ingredients: [{ name: "Aveia", quantity: 6, unit: "colheres de sopa" }, { name: "Ovo", quantity: 2, unit: "un" }, { name: "Leite", quantity: 100, unit: "ml" }],
} }), "create rejected");
await need(upload(`/api/recipes/${rej.json.id}/hero`, [210, 180, 140], "hero-rej.png"), "hero rejected");
await need(api(`/api/recipes/${rej.json.id}/reject`, { method: "POST", body: { reason: "Foto não segue o padrão de fundo" } }), "reject recipe");

const list = await need(api("/api/recipes"), "list");
console.log("Estados:", Object.fromEntries(list.json.items.map((r) => [r.name, r.status])));
