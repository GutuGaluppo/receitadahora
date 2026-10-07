// Critério de sucesso do MVP (docs/IMPLEMENTATION_STUDIO.md §41), de ponta a ponta, contra o Worker local (D1 + R2 reais).
import { api, upload, BASE } from "./lib.mjs";

let failures = 0;
const ok = (cond, label, extra) => { console.log(`${cond ? "✓" : "✗"} ${label}`); if (!cond) { failures++; if (extra !== undefined) console.log("   ", JSON.stringify(extra)); } };

const tag = Array.from({ length: 9 }, () => "BCDFGHJKLMNPQRSTVWXZ"[Math.floor(Math.random() * 20)]).join("");
console.log(`Studio em ${BASE} · sufixo ${tag}\n`);

// 1. criar lote
const batch = await api("/api/batches", { method: "POST" });
ok(batch.status === 201, `1. Lote #${String(batch.json.number).padStart(3, "0")} criado`);
const batchId = batch.json.id;

// biblioteca prévia: "Ovo" e "Sal" existem no seed? senão criamos (o teste não depende do seed)
for (const name of ["Ovo", "Sal"]) await api("/api/ingredients", { method: "POST", body: { name } });
const before = (await api("/api/ingredients")).json.coverage.total;

// 2/3/4/5. adicionar receitas; identificar ingredientes; reutilizar existentes; novos sem asset
const recipes = [
  {
    name: `Bowl de Quinoa ${tag}`, category: "Bowls", prep_time: 10, cook_time: 15, servings: 2,
    force_duplicate: true, description: "Teste automatizado.", instructions: ["Cozinhe a quinoa.", "Monte o bowl."],
    ingredients: [
      { name: `Quinoa ${tag}`, quantity: 1, unit: "xícara" },
      { name: "Ovos", quantity: 2, unit: "un" },          // plural → reutiliza "Ovo"
      { name: "sal", quantity: null, unit: "a gosto" },   // minúsculo → reutiliza "Sal"
    ],
  },
  {
    name: `Omelete de Quinoa ${tag}`, category: "Café da manhã", prep_time: 5, cook_time: 5, servings: 1,
    force_duplicate: true, description: "Teste automatizado.", instructions: ["Bata os ovos.", `Junte a quinoa ${tag}.`, "Frite."],
    ingredients: [
      { name: `quinoas ${tag} fresca`, quantity: 3, unit: "colheres" }, // variação → mesmo ingrediente novo
      { name: "Ovo", quantity: 3, unit: "un" },
      { name: `Cogumelo ${tag}`, quantity: 100, unit: "g" },
    ],
  },
];
const imp = await api(`/api/batches/${batchId}/import`, { method: "POST", body: { recipes } });
ok(imp.json.created === 2, "2. Duas receitas importadas no lote", imp.json);
const created = imp.json.results.filter((r) => r.result === "created");
ok(created[0].reused_ingredients === 2 && created[0].created_ingredients.length === 1, "3/4. Ovo e Sal reutilizados; Quinoa criada", created[0]);
ok(created[1].created_ingredients.length === 1 && created[1].created_ingredients[0].startsWith("Cogumelo"), "4. 'quinoas … fresca' resolveu para a MESMA Quinoa (só Cogumelo é novo)", created[1]);
const ingList = (await api("/api/ingredients")).json;
ok(ingList.coverage.total === before + 2, "4. Biblioteca cresceu só com ingredientes realmente novos (Quinoa + Cogumelo)", { before, after: ingList.coverage.total });
const quinoa = ingList.items.find((i) => i.name === `Quinoa ${tag}`);
ok(quinoa && quinoa.state === "missing" && quinoa.recipe_count === 2, "5. Quinoa aparece como 'sem asset' e usada por 2 receitas", quinoa);

// dúvida → decisão humana; duplicidade → decisão humana
const doubt = await api("/api/recipes", { method: "POST", body: { name: `Prato qualquer ${tag}`, category: "Teste", prep_time: 1, instructions: ["x"], ingredients: [{ name: `Cogumelo ${tag} paris` , quantity: 1, unit: "un" }] } });
ok(doubt.status === 409 && doubt.json.error === "needs_decision" && doubt.json.undecided[0].candidates[0].name === `Cogumelo ${tag}`, "   ingrediente PARECIDO pede decisão humana (não vira entidade nova sozinho)", doubt.json);
const decided = await api("/api/recipes", { method: "POST", body: { name: `Prato qualquer ${tag}`, category: "Teste", prep_time: 1, instructions: ["x"], ingredients: [{ name: `Cogumelo ${tag} paris`, quantity: 1, unit: "un", ingredient_id: doubt.json.undecided[0].candidates[0].id }] } });
ok(decided.status === 201, "   decisão 'usar existente' respeitada", decided.json);
if (decided.ok) await api(`/api/recipes/${decided.json.id}`, { method: "DELETE" });
const dup = await api("/api/recipes", { method: "POST", body: { ...recipes[0], force_duplicate: false, name: `Bowl de Quinoa ${tag} com ovos` } });

ok(dup.status === 409 && dup.json.error === "duplicate", "   duplicidade de receita detectada (nome+ingredientes)", dup.json);

// publicar ainda não pode: mostra o motivo
const r1 = created[0].id;
const early = await api(`/api/recipes/${r1}/publish`, { method: "POST" });
ok(early.status === 409 || early.status === 422, "   publicação acidental bloqueada", early.json);

// 6. upload das imagens faltantes (R2) — só dos ingredientes ausentes
const missing = (await api("/api/ingredients?state=missing")).json.items.filter((i) => i.name.endsWith(tag));
ok(missing.length === 2, "6. Só 2 assets ausentes a gerar (Quinoa, Cogumelo)", missing.map((m) => m.name));
for (const [i, m] of missing.entries()) {
  const up = await upload(`/api/ingredients/${m.id}/asset`, [60 * (i + 1), 120, 80], `${m.slug}.png`);
  ok(up.status === 201, `   upload ${m.name} → R2`, up.json);
  const file = await fetch(BASE + up.json.asset.url);
  ok(file.ok && file.headers.get("content-type") === "image/png", `   preview servido do R2 (${up.json.asset.key})`);
  ok((await api(`/api/ingredients/${m.id}/asset/approve`, { method: "POST" })).ok, `   ${m.name} aprovado`);
}
const notImg = await api(`/api/ingredients/${missing[0].id}/asset`, { method: "POST", form: (() => { const f = new FormData(); f.set("file", new Blob(["oi"], { type: "text/plain" }), "a.txt"); return f; })() });
ok(notImg.status === 415, "   arquivo que não é imagem → 415 (nada gravado)", notImg.json);
const after = (await api(`/api/ingredients/${missing[0].id}`)).json;
ok(after.versions.length === 1 && after.state === "approved", "   rejeição do upload não alterou a versão aprovada", after.versions.length);

// 7. imagem principal das receitas
const created2 = created[1].id;
for (const [i, id] of [r1, created2].entries()) {
  const up = await upload(`/api/recipes/${id}/hero`, [200, 100 + i * 40, 60], "hero.png");
  ok(up.status === 201 && up.json.version === 1, `7. Imagem principal v1 da receita ${i + 1} no R2`, up.json);
}
const d1 = (await api(`/api/recipes/${r1}`)).json;
ok(d1.status === "review", "   com tudo no lugar a receita entra sozinha em 'Em revisão'", d1.status);
ok(d1.publish_blockers.some((b) => b.code === "hero_not_approved"), "   publicação ainda bloqueada: imagem principal não aprovada");

// 8/9/10. revisar, aprovar, publicar
for (const id of [r1, created2]) {
  ok((await api(`/api/recipes/${id}/hero/approve`, { method: "POST" })).ok, "8. Imagem principal aprovada");
  ok((await api(`/api/recipes/${id}/approve`, { method: "POST" })).ok, "9. Receita aprovada");
}
const pub = await api(`/api/recipes/${r1}/publish`, { method: "POST" });
ok(pub.ok, "10. Receita publicada", pub.json);

// nova versão da imagem não sobrescreve a aprovada e tira a receita da publicação até nova aprovação
const v2 = await upload(`/api/recipes/${r1}/hero`, [10, 10, 200], "hero2.png");
const d1b = (await api(`/api/recipes/${r1}`)).json;
ok(v2.json.version === 2 && d1b.hero_versions.length === 2 && d1b.hero_versions[1].status === "approved", "    hero v2 criada; v1 aprovada preservada no histórico", d1b.hero_versions.map((v) => [v.version, v.status]));
ok(d1b.status === "review", "    receita publicada volta para revisão ao trocar a imagem (nada muda no app público sem aprovar)", d1b.status);
await api(`/api/recipes/${r1}/hero/activate/${d1b.hero_versions[1].id}`, { method: "POST" });
const back = (await api(`/api/recipes/${r1}`)).json;
ok(back.hero.version === 1, "    voltar para a v1 aprovada funciona", back.hero.version);
ok((await api(`/api/recipes/${r1}/approve`, { method: "POST" })).ok && (await api(`/api/recipes/${r1}/publish`, { method: "POST" })).ok, "    republicada");

// 11. o Receita da Hora consome só publicados
const pubList = (await fetch(BASE + "/api/public/recipes").then((r) => r.json())).items;
const mine = pubList.find((r) => r.id === r1);
ok(!!mine, "11. /api/public/recipes lista a receita publicada", pubList.map((r) => r.name));
ok(!pubList.some((r) => r.id === created2), "    receita só aprovada NÃO aparece no público");
const detail = await fetch(BASE + `/api/public/recipes/${back.slug}`).then((r) => r.json());
ok(detail.ingredients.length === 3 && detail.ingredients.every((i) => i.image), "    detalhe público traz ingredientes com imagem", detail.ingredients);
ok(!("status" in detail) && !("batch" in detail) && !("reject_reason" in detail), "    nada de metadata interna no payload público");
const img = await fetch(BASE + detail.image);
ok(img.ok && img.headers.get("access-control-allow-origin") === "*", "    imagem pública servida (CORS aberto)");
const draftSlug = (await api(`/api/recipes/${created2}`)).json.slug;
ok((await fetch(BASE + `/api/public/recipes/${draftSlug}`)).status === 404, "    receita não publicada → 404 no público");
const privateAsset = (await api(`/api/recipes/${created2}`)).json.hero.url.replace("/api/assets/", "/api/public/assets/");
ok((await fetch(BASE + privateAsset)).status === 404, "    imagem de receita não publicada → 404 no público");

// dashboard reflete tudo
const dash = (await api("/api/dashboard")).json;
ok(dash.ingredients.total === before + 2 && typeof dash.ingredients.percent === "number", "    dashboard e cobertura coerentes", dash.ingredients);

// exclusão em uso mostra o impacto
const del = await api(`/api/ingredients/${quinoa.id}`, { method: "DELETE" });
ok(del.status === 409 && del.json.used_by.length === 2, "    excluir ingrediente em uso é bloqueado e mostra as receitas", del.json);

console.log(failures ? `\n${failures} verificação(ões) falharam` : "\nFluxo completo OK");
process.exit(failures ? 1 : 0);
