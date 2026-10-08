// Critério de sucesso da Content Factory (implementations/IMPLEMENTATION_FABRICA_DE_CONTEUDO.md §49),
// de ponta a ponta contra o Worker local (D1 + R2 reais, provider mock, imagens desligadas).
// O catálogo do mock é finito: rode num banco recém-resetado (npm run db:reset:local) para o roteiro completo.
import { api, upload, BASE } from "./lib.mjs";

let failures = 0;
const ok = (cond, label, extra) => { console.log(`${cond ? "✓" : "✗"} ${label}`); if (!cond) { failures++; if (extra !== undefined) console.log("   ", JSON.stringify(extra).slice(0, 600)); } };
const key = () => crypto.randomUUID();
const gen = (body) => api("/api/factory/jobs", { method: "POST", body: { idempotency_key: key(), ...body } });
const detail = async (id) => (await api(`/api/factory/jobs/${id}`)).json;

console.log(`Studio em ${BASE}\n`);

// ── 0. estado inicial obrigatório (§50)
const cfg = (await api("/api/factory/config")).json;
ok(cfg.flags.content_generation === true && cfg.flags.image_generation === false && cfg.flags.auto_batch_generation === false, "0. Flags: texto ligado; imagem e automação desligadas", cfg.flags);
ok(cfg.providers.recipe === "mock" && cfg.providers.image === "disabled", "   providers: mock + imagens desativadas", cfg.providers);

// ── 1-3. brief → job (idempotente) → receitas via mock
const brief = { count: 8, meal_time: "Café da manhã" };
const k1 = key();
const [a, b] = await Promise.all([
  api("/api/factory/jobs", { method: "POST", body: { ...brief, idempotency_key: k1 } }),
  api("/api/factory/jobs", { method: "POST", body: { ...brief, idempotency_key: k1 } }),
]);
ok(a.json.job?.id === b.json.job?.id, "1. Clique duplicado (mesma idempotency key) → UM job só", [a.status, b.status, a.json.job?.code, b.json.job?.code]);
const j1 = a.json.job;
ok(j1.status === "completed" && j1.provider === "mock" && j1.template_version === "v1", `2. ${j1.code} concluído via provider mock, template ${j1.template_version}`, j1);
const d1 = await detail(j1.id);
ok(d1.batch && d1.summary.generated >= 3, `3. Lote #${d1.batch?.number} criado automaticamente com ${d1.summary.generated} receitas geradas`, d1.summary);
const batches = (await api("/api/batches")).json.items;
ok(batches.find((x) => x.id === d1.batch.id)?.source === "factory", "   lote marcado como Factory");

// ── 4. validação + provenance + nada publicado
const created1 = d1.items.filter((i) => i.outcome === "created");
ok(created1.length >= 2, "4. Receitas salvas como rascunho", d1.items.map((i) => [i.name, i.outcome]));
const full = (await api(`/api/recipes/${created1[0].recipe_id}`)).json;
ok(full.provenance.source_type === "generated" && full.provenance.source_job_id === j1.id && full.provenance.provider === "mock" && full.provenance.template_version === "v1", "   proveniência: generated + job + provider + template", full.provenance);
ok(["draft", "image_pending"].includes(full.status), `   status inicial '${full.status}' (nunca published)`);
ok(created1.every((i) => ["draft", "image_pending"].includes(i.recipe.status)), "   nenhuma receita gerada pulou a revisão");

// ── 5-6. ingredientes reutilizados e assets ausentes
const covs = created1.map((i) => i.details.coverage);
ok(covs.some((c) => c.reused > 0), "5. Ingredientes existentes (ex.: Ovo, Sal) foram REUTILIZADOS, não recriados", covs.map((c) => [c.reused, c.created]));
ok(covs.every((c) => c.missing.length === c.total - c.approved - c.in_review), "6. Assets ausentes identificados por receita", covs.map((c) => [c.total, c.approved, c.missing.length]));
const lib = (await api("/api/ingredients")).json.items;
const dupNames = lib.map((i) => i.name.toLowerCase());
ok(new Set(dupNames).size === dupNames.length, "   biblioteca sem entidades duplicadas");

// ── 7. imagens: jobs preparados mas DESATIVADOS, nenhuma chamada
const jobs1 = (await api("/api/factory/jobs?scope=queue")).json.items;
const imgJobs = jobs1.filter((j) => j.type.endsWith("_image"));
ok(imgJobs.length > 0 && imgJobs.every((j) => j.status === "disabled" && j.provider === "disabled" && j.actual_cost === 0), `7. ${imgJobs.length} jobs de imagem criados em 'disabled' (provider disabled, custo 0)`, imgJobs.slice(0, 2));
const rj = await api(`/api/factory/jobs/${imgJobs[0].id}/retry`, { method: "POST" });
ok(rj.status === 403 && /IMAGE_GENERATION_ENABLED/.test(rj.json.message), "   executar job de imagem com a flag desligada → 403 'Image generation is currently disabled'", rj.json);
const prep = await api(`/api/factory/jobs/${j1.id}/prepare-assets`, { method: "POST" });
ok(prep.ok && prep.json.created === 0 && prep.json.status === "disabled", "   Prepare Assets não duplica jobs ativos", prep.json);

// ── 8. duplicidade (receita quase igual à do seed) → decisão humana, nunca descarte automático
const dups = d1.items.filter((i) => i.outcome === "duplicate");
if (dups.length) {
  ok(dups[0].details.duplicates[0].score >= 0.55, `8. Possível duplicata detectada: "${dups[0].name}" ~ "${dups[0].details.duplicates[0].name}" (${Math.round(dups[0].details.duplicates[0].score * 100)}%)`);
  const keep = await api(`/api/factory/items/${dups[0].id}/keep`, { method: "POST" });
  ok(keep.ok && keep.json.outcome === "created", "   'Keep as draft' cria a receita", keep.json);
  ok((await api(`/api/factory/items/${dups[0].id}/keep`, { method: "POST" })).status === 409, "   decisão não se repete (409)");
} else console.log("• 8. (sem duplicata neste catálogo/estado — coberto em tests/factory.test.ts)");

// ── 10. falhas: externa (retry ok), estrutural (bruto preservado), inválida
const jf = (await gen({ count: 1, category: "Lanche", notes: "[mock:fail-external]" })).json.job;
ok(jf.status === "failed" && jf.error_kind === "external", "10. Falha externa simulada → job 'failed' (external)", jf);
const rr = await api(`/api/factory/jobs/${jf.id}/retry`, { method: "POST" });
ok(rr.ok && rr.json.job.status === "completed" && rr.json.job.attempts === 2, "    Retry manual → concluído na 2ª tentativa", rr.json.job);

const jm = (await gen({ count: 1, notes: "[mock:malformed]" })).json.job;
ok(jm.status === "failed" && jm.error_kind === "structural" && jm.has_raw_output, "    Saída malformada → failed (structural) com resultado bruto PRESERVADO", jm);
const raw = (await api(`/api/factory/jobs/${jm.id}/raw`)).json;
ok(/Claro!/.test(raw.raw), "    'View details' devolve o bruto original");
await api(`/api/factory/jobs/${jm.id}/retry`, { method: "POST" });
await api(`/api/factory/jobs/${jm.id}/retry`, { method: "POST" });
const cap = await api(`/api/factory/jobs/${jm.id}/retry`, { method: "POST" });
ok(cap.status === 409 && cap.json.error === "max_attempts", "    sem loop infinito: 3 tentativas e pronto", cap.json);
ok((await api(`/api/factory/jobs/${jm.id}/cancel`, { method: "POST" })).ok && (await detail(jm.id)).job.status === "cancelled", "    Cancel marca como cancelled");

const ji = (await gen({ count: 3, category: "Saladas", notes: "[mock:invalid]" })).json.job;
const di = await detail(ji.id);
const inv = di.items.find((i) => i.outcome === "invalid");
ok(ji.status === "completed" && inv && inv.details.issues.length > 0, "    receita inválida isolada (as outras seguem) com motivo", di.items.map((i) => [i.name, i.outcome]));
if (inv) ok((await api(`/api/factory/items/${inv.id}/discard`, { method: "POST" })).ok, "    inválida pode ser descartada");

// ── 9. ambiguidade de ingredientes → decisão humana (junta as ambiguidades de todos os jobs acima)
const j2 = (await gen({ count: 8, category: "Jantar" })).json.job;
const ambiguous = [];
for (const id of [j2.id, jf.id, ji.id]) for (const it of (await detail(id)).items) if (it.outcome === "needs_decision") ambiguous.push({ ...it, job: id });
ok(j2.status === "completed", `9. ${j2.code} (Jantar) concluído`, j2);
if (ambiguous.length >= 1) {
  ok(ambiguous.every((i) => !i.recipe_id), `   ${ambiguous.length} receita(s) com ingrediente ambíguo: nada foi criado antes da decisão`, ambiguous.map((i) => [i.name, i.details.undecided.map((u) => u.name)]));
  const [x, y, z] = ambiguous;
  const useExisting = await api(`/api/factory/items/${x.id}/resolve`, { method: "POST", body: { decisions: x.details.undecided.map((u) => ({ name: u.name, ingredient_id: u.candidates[0].id })) } });
  ok(useExisting.ok && useExisting.json.outcome === "created", "   decisão 'usar existente' → receita criada", useExisting.json);
  if (y) {
    const before = (await api("/api/ingredients")).json.coverage.total;
    const createNew = await api(`/api/factory/items/${y.id}/resolve`, { method: "POST", body: { decisions: y.details.undecided.map((u) => ({ name: u.name, create: true })) } });
    ok(createNew.ok && createNew.json.outcome === "created", "   decisão 'criar novo' → receita criada", createNew.json);
    ok((await api("/api/ingredients")).json.coverage.total > before, "   e o ingrediente novo entrou na biblioteca");
  }
  if (z) {
    const disc = await api(`/api/factory/items/${z.id}/discard`, { method: "POST" });
    ok(disc.ok && (await detail(z.job)).items.find((i) => i.id === z.id).outcome === "discarded", "   'Discard' fica registrado (outcome=discarded)", disc.json);
    ok((await detail(z.job)).events.some((e) => e.event_type === "item.discarded"), "   evento item.discarded no histórico");
  }
} else console.log("• 9. (nenhuma ambiguidade neste estado do banco)");

// ── 11. regeneração granular
const target = (await detail(j1.id)).items.find((i) => i.outcome === "created").recipe;
const rd = await api(`/api/factory/recipes/${target.id}/regenerate`, { method: "POST", body: { part: "description", idempotency_key: key() } });
const afterD = (await api(`/api/recipes/${target.id}`)).json;
ok(rd.status === 201 && rd.json.job.type === "description" && afterD.description !== target.description && afterD.name === target.name, "11. Regenerar SÓ a descrição: texto mudou, nome/ingredientes intactos", [target.description, afterD.description]);
const ri = await api(`/api/factory/recipes/${target.id}/regenerate`, { method: "POST", body: { part: "instructions", idempotency_key: key() } });
const afterI = (await api(`/api/recipes/${target.id}`)).json;
ok(ri.json.job.type === "metadata" && JSON.stringify(afterI.instructions) !== JSON.stringify(target.instructions) && afterI.description === afterD.description, "    Regenerar SÓ as instruções", afterI.instructions);
const rimg = await api(`/api/factory/recipes/${target.id}/regenerate`, { method: "POST", body: { part: "image", idempotency_key: key() } });
ok(rimg.json.job?.type === "recipe_image" && rimg.json.job.status === "disabled", "    Regenerar imagem → job 'disabled' (sem chamada; reaproveita o job ativo se já existir)", rimg.json);

// ── 12. revisão → aprovação manual → publicação pelo fluxo existente
const rid = target.id;
const rec = (await api(`/api/recipes/${rid}`)).json;
for (const [n, ing] of rec.ingredients.entries()) {
  if (ing.asset?.status === "approved") continue;
  const up = await upload(`/api/ingredients/${ing.ingredient_id}/asset`, [40 + n * 15, 120, 90], `${ing.slug}.png`, { approve: "true" });
  if (!up.ok) ok(false, `upload ${ing.name}`, up.json);
}
const hero = await upload(`/api/recipes/${rid}/hero`, [200, 150, 90], "hero.png");
ok(hero.status === 201, "12. Imagens enviadas manualmente (flag de imagem segue desligada)", hero.json);
const early = (await api(`/api/recipes/${rid}`)).json;
ok(early.status === "review", "    com tudo no lugar a receita gerada entra em 'review'", early.status);
ok((await api(`/api/recipes/${rid}/publish`, { method: "POST" })).status >= 400, "    publicar sem aprovar é bloqueado");
await api(`/api/recipes/${rid}/hero/approve`, { method: "POST" });
ok((await api(`/api/recipes/${rid}/approve`, { method: "POST" })).ok, "13. Aprovação manual");
const appr = (await api(`/api/recipes/${rid}`)).json;
ok(appr.provenance.approved_by && appr.provenance.approved_at, "    approved_by / approved_at registrados", appr.provenance);
ok((await api(`/api/recipes/${rid}/publish`, { method: "POST" })).ok, "14. Publicada pelo fluxo existente");
const pub = (await fetch(BASE + "/api/public/recipes").then((r) => r.json())).items;
ok(pub.some((r) => r.id === rid), "    aparece em /api/public/recipes");

// resumo vivo + dashboard + custos
const sum = (await detail(j1.id)).summary;
ok(sum.approved >= 1 && sum.created >= 1, "    resumo do job reflete a aprovação", sum);
const ov = (await api("/api/factory/overview")).json;
ok(["Needs review", "Completed", "Failed", "Blocked", "Idle"].includes(ov.state) && ov.current?.batch, `    overview/dashboard: estado '${ov.state}', lote atual #${ov.current?.batch?.number}`);
const cfg2 = (await api("/api/factory/config")).json;
ok(cfg2.spend.today === 0 && cfg2.spend.month === 0, "    custo do dia e do mês = $0.00 (mock + imagens off)", cfg2.spend);
const hist = (await api("/api/factory/jobs?type=recipe&status=failed")).json.items;
ok(hist.every((j) => j.type === "recipe" && j.status === "failed"), "    History: filtros por tipo/status funcionam");
const tpls = (await api("/api/factory/templates")).json.items;
ok(tpls.some((t) => t.type === "recipe_image" && t.version === "v0.1" && t.is_active), "    templates versionados no D1 (recipe-photography v0.1 ativo)");

console.log(failures ? `\n${failures} verificação(ões) falharam` : "\nFábrica de Conteúdo OK");
process.exit(failures ? 1 : 0);
