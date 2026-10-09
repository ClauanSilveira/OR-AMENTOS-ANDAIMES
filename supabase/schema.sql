-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Depois cadastre o administrador (troque pelo seu e-mail de login do app):
--   insert into public.admins(email) values ('SEU-EMAIL@exemplo.com');

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security; -- sem políticas: ninguém lê pela API

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid(),
  dono_email text default (auth.jwt() ->> 'email'),
  status text not null default 'Não iniciado',
  local text,
  data date,
  dados jsonb not null,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
alter table public.visitas enable row level security;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

-- só o admin muda status; quem solicita sempre começa em "Não iniciado"
create or replace function public.visitas_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado := now();
  if not public.eh_admin() then
    if tg_op = 'INSERT' then new.status := 'Não iniciado';
    else new.status := old.status; new.dono := old.dono; new.dono_email := old.dono_email; end if;
  end if;
  return new;
end $$;
drop trigger if exists visitas_guarda on public.visitas;
create trigger visitas_guarda before insert or update on public.visitas
  for each row execute function public.visitas_guarda();

drop policy if exists "ver" on public.visitas;
drop policy if exists "enviar" on public.visitas;
drop policy if exists "editar" on public.visitas;
drop policy if exists "apagar" on public.visitas;
create policy "ver" on public.visitas for select to authenticated
  using (dono = auth.uid() or public.eh_admin());
create policy "enviar" on public.visitas for insert to authenticated
  with check (dono = auth.uid() or public.eh_admin());
create policy "editar" on public.visitas for update to authenticated
  using (public.eh_admin() or (dono = auth.uid() and status = 'Não iniciado'))
  with check (public.eh_admin() or dono = auth.uid());
create policy "apagar" on public.visitas for delete to authenticated
  using (public.eh_admin() or (dono = auth.uid() and status = 'Não iniciado'));

-- consulta rápida: o app pergunta se o usuário é admin
create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = public as $$ select public.eh_admin() $$;
