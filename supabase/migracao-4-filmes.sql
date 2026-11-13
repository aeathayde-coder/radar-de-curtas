-- Radar de Festivais · migração 4: planejamento por projeto, checklist, notas e prêmios
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run (depois da migração 3).
-- Os festivais já salvos passam para a lista "Para acompanhar" (salvos sem projeto).
-- Pode rodar de novo sem problema.

create table if not exists public.films (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  duration_min    int check (duration_min is null or duration_min between 1 and 600),
  genre           text check (genre is null or char_length(genre) <= 40),
  finished_on     date,
  premiere_status text not null default 'inedito' check (premiere_status in ('inedito', 'exibido_brasil', 'exibido_exterior')),
  country         text not null default 'Brasil' check (char_length(country) <= 60),
  created_at      timestamptz not null default now()
);
alter table public.films add column if not exists general boolean not null default false;
create index if not exists films_user on public.films (user_id);
-- No máximo uma lista "Para acompanhar" por pessoa
create unique index if not exists films_one_general on public.films (user_id) where general;
alter table public.films enable row level security;
drop policy if exists "filmes: ler os próprios" on public.films;
create policy "filmes: ler os próprios" on public.films for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "filmes: inserir os próprios" on public.films;
create policy "filmes: inserir os próprios" on public.films for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "filmes: atualizar os próprios" on public.films;
create policy "filmes: atualizar os próprios" on public.films for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "filmes: remover os próprios" on public.films;
create policy "filmes: remover os próprios" on public.films for delete to authenticated using ((select auth.uid()) = user_id);
revoke update on public.films from authenticated, anon;
grant update (title, duration_min, genre, finished_on, premiere_status, country) on public.films to authenticated;

-- Cada salvo passa a pertencer a um filme, com checklist, notas e prêmio
alter table public.saved_festivals add column if not exists film_id uuid references public.films (id) on delete cascade;
alter table public.saved_festivals add column if not exists notes text check (notes is null or char_length(notes) <= 4000);
alter table public.saved_festivals add column if not exists checklist jsonb;
alter table public.saved_festivals add column if not exists award text check (award is null or char_length(award) <= 200);

insert into public.films (user_id, title, general)
select distinct s.user_id, 'Para acompanhar', true from public.saved_festivals s
where s.film_id is null and not exists (select 1 from public.films f where f.user_id = s.user_id and f.general);

update public.saved_festivals s
set film_id = (select f.id from public.films f where f.user_id = s.user_id and f.general limit 1)
where s.film_id is null;

alter table public.saved_festivals alter column film_id set not null;
alter table public.saved_festivals drop constraint if exists saved_festivals_pkey;
alter table public.saved_festivals add primary key (user_id, film_id, festival_id);

-- Salvar e mover só para listas da própria pessoa
drop policy if exists "salvos: inserir os próprios" on public.saved_festivals;
create policy "salvos: inserir os próprios" on public.saved_festivals
  for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.films f where f.id = film_id and f.user_id = (select auth.uid())));
drop policy if exists "salvos: atualizar os próprios" on public.saved_festivals;
create policy "salvos: atualizar os próprios" on public.saved_festivals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.films f where f.id = film_id and f.user_id = (select auth.uid())));

revoke update on public.saved_festivals from authenticated, anon;
grant update (status, notes, checklist, award, film_id) on public.saved_festivals to authenticated;
