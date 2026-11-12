-- Radar de Festivais · migração 3: avisos de mudança, agenda assinável e buscas salvas
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run.
-- O site funciona sem esta migração; com ela, aparecem os três recursos novos.

-- Perfil: liga/desliga o aviso de mudança e guarda o código da agenda assinável
alter table public.profiles add column if not exists change_alerts boolean not null default true;
alter table public.profiles add column if not exists calendar_token text unique
  check (calendar_token is null or calendar_token ~ '^[a-z0-9]{20,64}$');
grant update (email_opt_in, reminder_days, full_name, change_alerts, calendar_token) on public.profiles to authenticated;

-- Buscas salvas (params = filtros da URL do site, ex.: g=Documentário&dur=20&br=1)
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  label      text not null check (char_length(label) <= 300),
  params     text not null check (char_length(params) <= 1000),
  notify     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user on public.saved_searches (user_id);
alter table public.saved_searches enable row level security;

drop policy if exists "buscas: ler as próprias" on public.saved_searches;
create policy "buscas: ler as próprias" on public.saved_searches
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "buscas: inserir as próprias" on public.saved_searches;
create policy "buscas: inserir as próprias" on public.saved_searches
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "buscas: atualizar as próprias" on public.saved_searches;
create policy "buscas: atualizar as próprias" on public.saved_searches
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "buscas: remover as próprias" on public.saved_searches;
create policy "buscas: remover as próprias" on public.saved_searches
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke update on public.saved_searches from authenticated, anon;
grant update (notify, label) on public.saved_searches to authenticated;

-- Só o servidor acessa (RLS ligado e sem políticas): foto da base, mudanças detectadas e avisos enviados
create table if not exists public.festival_snapshots (
  festival_id text primary key,
  deadline    date,
  date_status text,
  seen_at     timestamptz not null default now()
);
create table if not exists public.festival_changes (
  id          bigint generated always as identity primary key,
  festival_id text not null,
  kind        text not null check (kind in ('novo', 'confirmada', 'prazo')),
  before      text,
  after       text,
  detected_at timestamptz not null default now()
);
create table if not exists public.digest_sent (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  change_id bigint not null references public.festival_changes (id) on delete cascade,
  sent_at   timestamptz not null default now(),
  primary key (user_id, change_id)
);
alter table public.festival_snapshots enable row level security;
alter table public.festival_changes   enable row level security;
alter table public.digest_sent        enable row level security;
