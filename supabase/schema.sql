-- Radar de Curtas · esquema do Supabase
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run.

-- Perfil de cada pessoa logada (criado automaticamente no primeiro login com Google)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  email_opt_in  boolean not null default true,
  reminder_days int[]   not null default '{30,7,1}'
                check (reminder_days <@ array[1,3,7,14,30]),
  created_at    timestamptz not null default now()
);

-- Festivais salvos (festival_id = id da página no Notion)
create table if not exists public.saved_festivals (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  festival_id   text not null check (char_length(festival_id) <= 64),
  festival_name text check (char_length(festival_name) <= 300),
  created_at    timestamptz not null default now(),
  primary key (user_id, festival_id)
);

-- Registro de lembretes enviados (evita e-mail duplicado; se o prazo mudar, o lembrete volta a valer)
create table if not exists public.reminders_sent (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  festival_id text not null,
  deadline    date not null,
  days_before int  not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, festival_id, deadline, days_before)
);

alter table public.profiles        enable row level security;
alter table public.saved_festivals enable row level security;
alter table public.reminders_sent  enable row level security; -- sem políticas: só a função do servidor acessa

-- Perfis: cada pessoa lê e edita só o próprio
drop policy if exists "perfil: ler o próprio" on public.profiles;
create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- O e-mail de destino vem do Google e não pode ser trocado pelo navegador
revoke update on public.profiles from authenticated, anon;
grant update (email_opt_in, reminder_days, full_name) on public.profiles to authenticated;

-- Festivais salvos: cada pessoa vê, salva e remove só os seus
drop policy if exists "salvos: ler os próprios" on public.saved_festivals;
create policy "salvos: ler os próprios" on public.saved_festivals
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "salvos: inserir os próprios" on public.saved_festivals;
create policy "salvos: inserir os próprios" on public.saved_festivals
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "salvos: remover os próprios" on public.saved_festivals;
create policy "salvos: remover os próprios" on public.saved_festivals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Cria o perfil no primeiro login
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
