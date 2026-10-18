-- ============================================================
-- MISIÓN ESTRELLAS · Migración v1 (una sola familia) → v2
-- (multi-familias con administrador)
--
-- Ejecuta esto SOLO si ya habías creado las tablas con la versión
-- anterior y quieres conservar los datos existentes.
-- Si empiezas de cero, no toques este archivo: usa schema.sql.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. Tablas nuevas ----------
create table if not exists public.admins (
  email text primary key
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null default 'parent' check (role in ('parent','kids')),
  created_at timestamptz not null default now()
);

-- ---------- 2. Columna family_id ----------
alter table public.children add column if not exists family_id uuid references public.families(id) on delete cascade;
alter table public.rewards  add column if not exists family_id uuid references public.families(id) on delete cascade;

create index if not exists idx_members_family  on public.family_members(family_id);
create index if not exists idx_children_family on public.children(family_id);

-- ---------- 3. Funciones auxiliares ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.family_members where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where user_id = auth.uid() and role = 'parent');
$$;

revoke execute on function public.is_admin()  from public, anon;
revoke execute on function public.my_family() from public, anon;
revoke execute on function public.is_parent() from public, anon;
grant execute on function public.is_admin()  to authenticated;
grant execute on function public.my_family() to authenticated;
grant execute on function public.is_parent() to authenticated;

-- ---------- 4. Familia por defecto con tus datos existentes ----------
-- Crea una familia "Nuestra familia" ligada a la PRIMERA cuenta de
-- usuarios de Supabase (la tuya, si ya la habías creado) y le asigna
-- todos los hijos y recompensas existentes.
do $$
declare uid uuid; fid uuid;
begin
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is not null and not exists (select 1 from public.family_members) then
    insert into public.families (name) values ('Nuestra familia') returning id into fid;
    insert into public.family_members (user_id, family_id, role) values (uid, fid, 'parent');
    update public.children set family_id = fid where family_id is null;
    update public.rewards  set family_id = fid where family_id is null;
  end if;
end $$;

-- ---------- 5. Recompensas por familia ----------
delete from public.rewards where family_id is null;

do $$
begin
  if not exists (select 1 from public.children where family_id is null) then
    alter table public.children alter column family_id set not null;
  end if;
end $$;

alter table public.rewards alter column family_id set not null;
alter table public.rewards drop constraint if exists rewards_pkey;
alter table public.rewards add primary key (family_id, day);

do $$
declare f record;
begin
  for f in select id from public.families loop
    insert into public.rewards (family_id, day, min_stars, emoji, label) values
      (f.id, 'viernes', 8,  '🎮', 'Jugar a la tablet'),
      (f.id, 'sabado',  10, '🕹️', 'Tiempo extra de tablet'),
      (f.id, 'domingo', 12, '📺', 'Película + tablet')
    on conflict (family_id, day) do nothing;
  end loop;
end $$;

-- ---------- 6. Quitar las políticas de la versión anterior ----------
drop policy if exists "lectura children"      on public.children;
drop policy if exists "lectura templates"     on public.task_templates;
drop policy if exists "lectura overrides"     on public.task_overrides;
drop policy if exists "lectura completions"   on public.completions;
drop policy if exists "lectura extras"        on public.extra_tasks;
drop policy if exists "lectura penalties"     on public.penalties;
drop policy if exists "lectura rewards"       on public.rewards;

drop policy if exists "escritura children"    on public.children;
drop policy if exists "escritura templates"   on public.task_templates;
drop policy if exists "escritura overrides"   on public.task_overrides;
drop policy if exists "escritura completions" on public.completions;
drop policy if exists "escritura extras"      on public.extra_tasks;
drop policy if exists "escritura penalties"   on public.penalties;
drop policy if exists "escritura rewards"     on public.rewards;

-- ---------- 7. Nuevas políticas multi-familia ----------
alter table public.admins         enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;

create policy "admins_select" on public.admins for select to authenticated using (is_admin());
create policy "admins_write"  on public.admins for all   to authenticated using (is_admin()) with check (is_admin());

create policy "families_select" on public.families for select to authenticated
  using (is_admin() or exists (select 1 from public.family_members m where m.family_id = families.id and m.user_id = auth.uid()));
create policy "families_write"  on public.families for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "members_select" on public.family_members for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "members_write"  on public.family_members for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "children_select" on public.children for select to authenticated
  using (family_id = my_family() or is_admin());
create policy "children_write"  on public.children for all to authenticated
  using ((is_parent() and family_id = my_family()) or is_admin())
  with check ((is_parent() and family_id = my_family()) or is_admin());

create policy "templates_select" on public.task_templates for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "templates_write"  on public.task_templates for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

create policy "completions_select" on public.completions for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "completions_write"  on public.completions for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

create policy "extras_select" on public.extra_tasks for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "extras_write"  on public.extra_tasks for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

create policy "penalties_select" on public.penalties for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "penalties_write"  on public.penalties for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

create policy "overrides_select" on public.task_overrides for select to authenticated
  using (is_admin() or exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                where t.id = template_id and c.family_id = my_family()));
create policy "overrides_write"  on public.task_overrides for all to authenticated
  using ((is_parent() and exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                  where t.id = template_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                      where t.id = template_id and c.family_id = my_family())) or is_admin());

create policy "rewards_select" on public.rewards for select to authenticated
  using (family_id = my_family() or is_admin());
create policy "rewards_write"  on public.rewards for all to authenticated
  using ((is_parent() and family_id = my_family()) or is_admin())
  with check ((is_parent() and family_id = my_family()) or is_admin());

-- ---------- 8. Tu cuenta de administrador ----------
-- Sustituye tu@email.com y ejecuta (una sola vez):
--
-- insert into public.admins (email) values ('tu@email.com')
-- on conflict do nothing;

-- ------------------------------------------------------------
-- NOTA: si al ejecutar el paso 4 no había NINGUNA cuenta de
-- usuarios en Supabase, los hijos seguirán sin familia. En ese
-- caso: crea la cuenta de papás (Authentication → Users), vuelve
-- a ejecutar SOLO el bloque DO del paso 4 y listo.
-- ------------------------------------------------------------
