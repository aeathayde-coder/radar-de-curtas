-- Radar de Festivais · migração 4: planejamento por filme, checklist, notas e prêmios
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run (depois da migração 3).
-- Os festivais já salvos passam para um primeiro filme, "Meu filme", que a pessoa pode renomear.

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
create index if not exists films_user on public.films (user_id);
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

insert into public.films (user_id, title)
select distinct s.user_id, 'Meu filme' from public.saved_festivals s
where s.film_id is null and not exists (select 1 from public.films f where f.user_id = s.user_id);

update public.saved_festivals s
set film_id = (select f.id from public.films f where f.user_id = s.user_id order by f.created_at limit 1)
where s.film_id is null;

alter table public.saved_festivals alter column film_id set not null;
alter table public.saved_festivals drop constraint if exists saved_festivals_pkey;
alter table public.saved_festivals add primary key (user_id, film_id, festival_id);

revoke update on public.saved_festivals from authenticated, anon;
grant update (status, notes, checklist, award) on public.saved_festivals to authenticated;
