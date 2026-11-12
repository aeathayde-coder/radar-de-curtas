-- Radar de Festivais · migração 5: equipe do projeto
-- Convites com perfil (editor ou apenas visualização), avisos por pessoa em cada projeto,
-- notas privadas ou compartilhadas e registro da atividade da equipe.
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run (depois da migração 4).
-- Pode rodar de novo sem problema. Não apaga nada: os festivais salvos continuam como estão.

-- ——— Membros de cada projeto (a criadora entra com o papel "dono" no primeiro convite) ———
create table if not exists public.film_members (
  film_id    uuid not null references public.films (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null check (role in ('dono', 'editor', 'leitor')),
  remind     boolean not null default true,   -- lembretes de prazo deste projeto
  changes    boolean not null default true,   -- mudanças nos festivais deste projeto
  activity   boolean not null default false,  -- resumo semanal da atividade da equipe
  created_at timestamptz not null default now(),
  primary key (film_id, user_id)
);
create index if not exists film_members_user on public.film_members (user_id);

-- ——— Convites pendentes (o convite vale só para o e-mail convidado) ———
create table if not exists public.film_invites (
  id         uuid primary key default gen_random_uuid(),
  film_id    uuid not null references public.films (id) on delete cascade,
  email      text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role       text not null check (role in ('editor', 'leitor')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (film_id, email)
);

-- ——— Notas: cada nota tem autora e pode ser privada ou compartilhada ———
create table if not exists public.festival_notes (
  id          uuid primary key default gen_random_uuid(),
  film_id     uuid not null references public.films (id) on delete cascade,
  festival_id text not null check (char_length(festival_id) <= 64),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  shared      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists festival_notes_film on public.festival_notes (film_id, festival_id);
-- Nome de quem escreveu, guardado na nota (continua aparecendo se a pessoa sair do projeto)
alter table public.festival_notes add column if not exists author_name text check (author_name is null or char_length(author_name) <= 200);

-- ——— Atividade da equipe (só o servidor lê) ———
create table if not exists public.film_activity (
  id          bigint generated always as identity primary key,
  film_id     uuid not null references public.films (id) on delete cascade,
  actor       uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in ('incluiu', 'tirou', 'situacao')),
  festival_id text not null,
  detail      text,
  at          timestamptz not null default now()
);
create index if not exists film_activity_film on public.film_activity (film_id, at);
create table if not exists public.activity_sent (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  activity_id bigint not null references public.film_activity (id) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (user_id, activity_id)
);

alter table public.film_members   enable row level security;
alter table public.film_invites   enable row level security;
alter table public.festival_notes enable row level security;
alter table public.film_activity  enable row level security; -- sem políticas: só o servidor
alter table public.activity_sent  enable row level security; -- sem políticas: só o servidor

-- ——— Papel de quem está logado num projeto: 'dono', 'editor', 'leitor' ou null ———
create or replace function public.film_role(p_film uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when f.user_id = (select auth.uid()) then 'dono'
    else (select m.role from public.film_members m where m.film_id = p_film and m.user_id = (select auth.uid()))
  end
  from public.films f where f.id = p_film;
$$;
create or replace function public.film_owner(p_film uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select f.user_id from public.films f where f.id = p_film;
$$;
revoke all on function public.film_role(uuid) from public, anon;
revoke all on function public.film_owner(uuid) from public, anon;
grant execute on function public.film_role(uuid) to authenticated;
grant execute on function public.film_owner(uuid) to authenticated;

-- ——— Projetos: quem participa também lê; editar e apagar continua só com a dona ———
drop policy if exists "filmes: ler os próprios" on public.films;
create policy "filmes: ler os próprios" on public.films for select to authenticated
  using ((select auth.uid()) = user_id or public.film_role(id) is not null);

-- ——— Festivais salvos: a linha pertence à dona do projeto; editor também inclui, altera e tira ———
drop policy if exists "salvos: ler os próprios" on public.saved_festivals;
create policy "salvos: ler os próprios" on public.saved_festivals for select to authenticated
  using ((select auth.uid()) = user_id or public.film_role(film_id) is not null);

drop policy if exists "salvos: inserir os próprios" on public.saved_festivals;
create policy "salvos: inserir os próprios" on public.saved_festivals for insert to authenticated
  with check (public.film_role(film_id) in ('dono', 'editor') and user_id = public.film_owner(film_id));

drop policy if exists "salvos: atualizar os próprios" on public.saved_festivals;
create policy "salvos: atualizar os próprios" on public.saved_festivals for update to authenticated
  using (public.film_role(film_id) in ('dono', 'editor'))
  with check (public.film_role(film_id) in ('dono', 'editor') and user_id = public.film_owner(film_id));

drop policy if exists "salvos: remover os próprios" on public.saved_festivals;
create policy "salvos: remover os próprios" on public.saved_festivals for delete to authenticated
  using (public.film_role(film_id) in ('dono', 'editor'));

-- ——— Membros: todos do projeto veem a equipe; a dona muda perfis e remove; cada pessoa ajusta os próprios avisos e pode sair ———
drop policy if exists "membros: ler" on public.film_members;
create policy "membros: ler" on public.film_members for select to authenticated
  using (public.film_role(film_id) is not null);
drop policy if exists "membros: atualizar" on public.film_members;
create policy "membros: atualizar" on public.film_members for update to authenticated
  using (public.film_role(film_id) = 'dono' or user_id = (select auth.uid()))
  with check (public.film_role(film_id) = 'dono' or user_id = (select auth.uid()));
drop policy if exists "membros: remover" on public.film_members;
create policy "membros: remover" on public.film_members for delete to authenticated
  using (role <> 'dono' and (public.film_role(film_id) = 'dono' or user_id = (select auth.uid())));
revoke insert, update on public.film_members from authenticated, anon;
grant update (role, remind, changes, activity) on public.film_members to authenticated;

create or replace function public.guard_member_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    if old.role = 'dono' or new.role = 'dono' or public.film_role(old.film_id) is distinct from 'dono' then
      raise exception 'Só a criadora do projeto muda o perfil das pessoas.';
    end if;
  end if;
  if new.user_id <> old.user_id or new.film_id <> old.film_id then
    raise exception 'Alteração não permitida.';
  end if;
  return new;
end;
$$;
drop trigger if exists film_members_guard on public.film_members;
create trigger film_members_guard before update on public.film_members
  for each row execute function public.guard_member_role();

-- Quem sai ou é removido leva as próprias notas privadas daquele projeto
create or replace function public.member_gone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.festival_notes where film_id = old.film_id and user_id = old.user_id and not shared;
  return old;
end;
$$;
drop trigger if exists film_members_gone on public.film_members;
create trigger film_members_gone after delete on public.film_members
  for each row execute function public.member_gone();

-- ——— Convites: só a dona vê, muda o perfil e cancela. A criação passa pelo servidor (/api/equipe) ———
drop policy if exists "convites: ler" on public.film_invites;
create policy "convites: ler" on public.film_invites for select to authenticated
  using (public.film_role(film_id) = 'dono');
drop policy if exists "convites: atualizar" on public.film_invites;
create policy "convites: atualizar" on public.film_invites for update to authenticated
  using (public.film_role(film_id) = 'dono') with check (public.film_role(film_id) = 'dono');
drop policy if exists "convites: cancelar" on public.film_invites;
create policy "convites: cancelar" on public.film_invites for delete to authenticated
  using (public.film_role(film_id) = 'dono');
revoke insert, update on public.film_invites from authenticated, anon;
grant update (role) on public.film_invites to authenticated;

-- ——— Notas: a autora vê todas as suas; a equipe vê as compartilhadas ———
drop policy if exists "notas: ler" on public.festival_notes;
create policy "notas: ler" on public.festival_notes for select to authenticated
  using (user_id = (select auth.uid()) or (shared and public.film_role(film_id) is not null));
drop policy if exists "notas: escrever" on public.festival_notes;
create policy "notas: escrever" on public.festival_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.film_role(film_id) is not null);
drop policy if exists "notas: atualizar" on public.festival_notes;
create policy "notas: atualizar" on public.festival_notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.film_role(film_id) is not null);
-- A autora apaga as próprias notas; a dona do projeto apaga as notas compartilhadas de quem já saiu
drop policy if exists "notas: apagar" on public.festival_notes;
create policy "notas: apagar" on public.festival_notes for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (shared and public.film_role(film_id) = 'dono'
        and not exists (select 1 from public.film_members m where m.film_id = festival_notes.film_id and m.user_id = festival_notes.user_id))
  );
revoke update on public.festival_notes from authenticated, anon;
grant update (body, shared, film_id) on public.festival_notes to authenticated;

create or replace function public.touch_note()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists festival_notes_touch on public.festival_notes;
create trigger festival_notes_touch before update on public.festival_notes
  for each row execute function public.touch_note();

create or replace function public.note_author()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select left(coalesce(p.full_name, p.email), 200) into new.author_name from public.profiles p where p.id = new.user_id;
  return new;
end;
$$;
drop trigger if exists festival_notes_author on public.festival_notes;
create trigger festival_notes_author before insert on public.festival_notes
  for each row execute function public.note_author();
update public.festival_notes n set author_name = left(coalesce(p.full_name, p.email), 200)
from public.profiles p where p.id = n.user_id and n.author_name is null;

-- As notas antigas (campo único) viram notas privadas da dona
insert into public.festival_notes (film_id, festival_id, user_id, body, shared)
select s.film_id, s.festival_id, s.user_id, left(s.notes, 4000), false
from public.saved_festivals s
where s.notes is not null and btrim(s.notes) <> ''
  and not exists (select 1 from public.festival_notes n where n.film_id = s.film_id and n.festival_id = s.festival_id and n.user_id = s.user_id);

-- ——— Atividade: festival incluído, retirado ou com situação alterada ———
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.film_activity (film_id, actor, kind, festival_id) values (new.film_id, (select auth.uid()), 'incluiu', new.festival_id);
  elsif tg_op = 'DELETE' then
    insert into public.film_activity (film_id, actor, kind, festival_id) values (old.film_id, (select auth.uid()), 'tirou', old.festival_id);
  elsif new.status is distinct from old.status then
    insert into public.film_activity (film_id, actor, kind, festival_id, detail) values (new.film_id, (select auth.uid()), 'situacao', new.festival_id, new.status);
  end if;
  return null;
exception when others then
  return null; -- o registro de atividade nunca impede salvar
end;
$$;
drop trigger if exists saved_festivals_activity on public.saved_festivals;
create trigger saved_festivals_activity after insert or delete or update of status on public.saved_festivals
  for each row execute function public.log_activity();

-- ——— Funções chamadas pelo site ———
-- Equipe de um projeto (só para quem participa): dona, membros e convites pendentes
create or replace function public.film_team(p_film uuid)
returns table (kind text, user_id uuid, invite_id uuid, name text, email text, role text)
language sql stable security definer set search_path = '' as $$
  select 'dono', f.user_id, null::uuid, p.full_name, p.email, 'dono'
    from public.films f join public.profiles p on p.id = f.user_id
    where f.id = p_film and public.film_role(p_film) is not null
  union all
  select 'membro', m.user_id, null, p.full_name, p.email, m.role
    from public.film_members m join public.profiles p on p.id = m.user_id
    where m.film_id = p_film and m.role <> 'dono' and public.film_role(p_film) is not null
  union all
  select 'convite', null, i.id, null, i.email, i.role
    from public.film_invites i
    where i.film_id = p_film and public.film_role(p_film) is not null;
$$;

-- Convites pendentes para o e-mail de quem está logado
create or replace function public.my_invites()
returns table (id uuid, film_id uuid, film_title text, role text, inviter text)
language sql stable security definer set search_path = '' as $$
  select i.id, i.film_id, f.title, i.role, coalesce(p.full_name, p.email)
  from public.film_invites i
  join public.films f on f.id = i.film_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = lower((select auth.jwt()) ->> 'email');
$$;

-- Dados mínimos de um convite aberto pelo link, para avisar quando a conta não é a convidada
create or replace function public.invite_info(p_id uuid)
returns table (film_title text, inviter text, email_hint text, mine boolean)
language sql stable security definer set search_path = '' as $$
  select f.title, coalesce(p.full_name, p.email),
    left(split_part(i.email, '@', 1), 2) || '•••@' || split_part(i.email, '@', 2),
    i.email = lower((select auth.jwt()) ->> 'email')
  from public.film_invites i
  join public.films f on f.id = i.film_id
  left join public.profiles p on p.id = i.invited_by
  where i.id = p_id;
$$;

-- Aceitar: só com a conta do e-mail convidado
create or replace function public.accept_invite(p_id uuid, p_remind boolean default true, p_changes boolean default true, p_activity boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.film_invites;
begin
  select * into inv from public.film_invites where id = p_id;
  if inv.id is null then raise exception 'Convite não encontrado ou já usado.'; end if;
  if inv.email <> lower((select auth.jwt()) ->> 'email') then raise exception 'Este convite é para outro e-mail.'; end if;
  insert into public.film_members (film_id, user_id, role, remind, changes, activity)
  values (inv.film_id, (select auth.uid()), inv.role, p_remind, p_changes, p_activity)
  on conflict (film_id, user_id) do update set role = excluded.role, remind = excluded.remind, changes = excluded.changes, activity = excluded.activity
  where public.film_members.role <> 'dono';
  delete from public.film_invites where id = p_id;
  return inv.film_id;
end;
$$;

create or replace function public.decline_invite(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.film_invites where id = p_id and email = lower((select auth.jwt()) ->> 'email');
$$;

revoke all on function public.film_team(uuid) from public, anon;
revoke all on function public.my_invites() from public, anon;
revoke all on function public.invite_info(uuid) from public, anon;
revoke all on function public.accept_invite(uuid, boolean, boolean, boolean) from public, anon;
revoke all on function public.decline_invite(uuid) from public, anon;
grant execute on function public.film_team(uuid) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.invite_info(uuid) to authenticated;
grant execute on function public.accept_invite(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.decline_invite(uuid) to authenticated;
