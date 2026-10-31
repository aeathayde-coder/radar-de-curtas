-- Radar de Curtas · migração 2: acompanhamento dos festivais salvos
-- (Quero inscrever → Inscrito → Selecionado / Não selecionado)
-- Rodar uma vez em: Supabase → SQL Editor → New query → colar → Run.
-- O site funciona sem esta migração; com ela, aparece o seletor de situação na ficha do festival.

alter table public.saved_festivals
  add column if not exists status text not null default 'quero'
  check (status in ('quero', 'inscrito', 'selecionado', 'nao_selecionado'));

alter table public.saved_festivals
  add column if not exists updated_at timestamptz not null default now();

-- Cada pessoa só altera os próprios salvos, e só a situação
drop policy if exists "salvos: atualizar os próprios" on public.saved_festivals;
create policy "salvos: atualizar os próprios" on public.saved_festivals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.saved_festivals from authenticated, anon;
grant update (status) on public.saved_festivals to authenticated;

create or replace function public.touch_saved_festival()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_festivals_touch on public.saved_festivals;
create trigger saved_festivals_touch
  before update on public.saved_festivals
  for each row execute function public.touch_saved_festival();
