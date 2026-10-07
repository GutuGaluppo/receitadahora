# Receita da Hora

> **O que faz sentido comer agora?** Uma sugestão por vez, feita para o seu momento.

Web app responsivo (Next.js 16 · React 19 · TypeScript · Tailwind 4 · Framer Motion). A especificação completa está em [`docs/receita_da_hora_master_implementation_prompt.md`](docs/receita_da_hora_master_implementation_prompt.md).

## Rodando

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:3000
npm run check    # lint + tsc + testes
npm run build
```

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/services/recommendation.ts` | Motor determinístico: hard stops → score por camadas → diversidade → top 1 |
| `src/config/recommendation-weights.ts` | **Todos** os pesos (nada hardcoded no serviço) |
| `src/data/recipes.ts`, `palettes.ts` | 35 receitas curadas com traits, afinidade climática e paleta |
| `src/services/weather.ts` | Clima desacoplado (Open-Meteo, sem chave de API) |
| `src/services/storage.ts` | Persistência local-first validada com Zod (fronteira para trocar por Supabase) |
| `src/components/` | Home (máquina de estados), Biblioteca, Meu Gosto, Onboarding |
| `supabase/schema.sql` | Schema + RLS para a persistência em nuvem |
| `tests/` | Testes unitários do motor |

## Decisões que valem saber

- **Persistência**: hoje em `localStorage`, sem login. `supabase/schema.sql` já está pronto; falta criar o projeto Supabase, colocar `SUPABASE_URL`/`SUPABASE_KEY` e implementar o adaptador em `storage.ts`.
- **Imagens**: as receitas usam um prato ilustrado gerado da paleta. Para fotos reais, preencha `imageUrl` com um PNG/WebP **recortado** (fundo transparente) — o componente já aplica a sombra suave.
- **Clima**: Open-Meteo (gratuito). Só a cidade é guardada; coordenadas existem apenas durante a chamada.
- **Intenção temporária** ("Outra sugestão"): fica só em memória, expira em 30 min e nunca altera o perfil.
- **LGPD**: "Meu Gosto" tem exportar e apagar dados.
