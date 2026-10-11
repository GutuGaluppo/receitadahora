-- Teste manual de RLS com DOIS usuários (Gate D). Rode no SQL Editor do projeto de STAGING (nunca produção).
-- Cria dois usuários descartáveis, tenta ler/alterar dados do outro e DESFAZ tudo no final (rollback).
-- Resultado esperado: todas as linhas "ASSERT" retornam true; qualquer false = RLS quebrada.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@teste.invalid');

-- A grava dados
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into public.saved_recipes (id, user_id, recipe_id) values ('rls-s1', '00000000-0000-0000-0000-0000000000a1', 'recipe_x');
insert into public.recommendation_events (id, user_id, recipe_id, event_type) values ('rls-e1', '00000000-0000-0000-0000-0000000000a1', 'recipe_x', 'recipe_shown');

-- A não consegue inserir em nome de B
do $$ begin
  begin
    insert into public.saved_recipes (id, user_id, recipe_id) values ('rls-s2', '00000000-0000-0000-0000-0000000000b2', 'recipe_y');
    raise exception 'FALHA: A inseriu dado em nome de B';
  exception when insufficient_privilege or check_violation then null; -- esperado
  end;
end $$;

-- B não enxerga nem altera nada de A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select 'ASSERT B não vê salvos de A' as teste, (select count(*) from public.saved_recipes) = 0 as ok;
select 'ASSERT B não vê eventos de A' as teste, (select count(*) from public.recommendation_events) = 0 as ok;
delete from public.saved_recipes where id = 'rls-s1';
delete from public.recommendation_events where id = 'rls-e1';

-- A continua com seus dados (B não apagou) e pode apagar o próprio histórico
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select 'ASSERT A mantém salvos' as teste, (select count(*) from public.saved_recipes) = 1 as ok;
select 'ASSERT A mantém eventos' as teste, (select count(*) from public.recommendation_events) = 1 as ok;
delete from public.recommendation_events where id = 'rls-e1';
select 'ASSERT A apaga o próprio evento' as teste, (select count(*) from public.recommendation_events) = 0 as ok;

-- Papel anônimo não acessa nada
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.saved_recipes;
    raise exception 'FALHA: anon leu saved_recipes';
  exception when insufficient_privilege then null; -- esperado
  end;
end $$;

rollback;
