-- ============================================================
-- MISIÓN ESTRELLAS v2 · Multi-familias · Esquema para Supabase
-- Pega TODO este archivo en el SQL Editor de Supabase y pulsa RUN.
--
-- Si ya tenías las tablas de la versión anterior (una sola familia)
-- y quieres conservar los datos, ejecuta ANTES:
--   sql/migracion-multifamilia.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Administradores (el "super user")
-- ------------------------------------------------------------
create table if not exists public.admins (
  email text primary key
);

-- El email del superadministrador ya viene sembrado (se puede
-- repetir la ejecución sin problema; para añadir más emails:
--   insert into public.admins (email) values ('otro@email.com')
--   on conflict do nothing;
-- )
insert into public.admins (email) values ('luisromerovalentin@gmail.com')
on conflict do nothing;

-- ------------------------------------------------------------
-- Familias y sus cuentas de acceso
-- role: 'parent' (puede escribir) | 'kids' (solo lectura)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Hijos de cada familia
-- ------------------------------------------------------------
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  emoji text not null default '🦊',
  color text not null default '#7c3aed',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Plantilla de tareas que se repite cada semana
-- weekday: 1=lunes ... 5=viernes
-- ------------------------------------------------------------
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  weekday int not null check (weekday between 1 and 5),
  category text not null check (category in ('personal','casa','educativo')),
  title text not null,
  emoji text not null default '⭐',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Cambios "solo esta semana" (se aplican a una fecha concreta)
-- ------------------------------------------------------------
create table if not exists public.task_overrides (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  date date not null,
  title text,
  emoji text,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (template_id, date)
);

-- ------------------------------------------------------------
-- Estado de cada tarea cada día (✅ completada / ❌ fallada)
-- ------------------------------------------------------------
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null,
  status text not null check (status in ('done','failed')),
  created_at timestamptz not null default now(),
  unique (template_id, date)
);

-- ------------------------------------------------------------
-- Tareas EXTRA (para recuperar estrellas)
-- ------------------------------------------------------------
create table if not exists public.extra_tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null,
  title text not null,
  emoji text not null default '🎁',
  stars int not null default 1 check (stars between 1 and 5),
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Penalizaciones (3 puntos = 1 estrella perdida)
-- ------------------------------------------------------------
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  date date not null default current_date,
  reason text,
  points int not null default 1 check (points between 1 and 5),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Recompensas: una fila por familia y día
-- ------------------------------------------------------------
create table if not exists public.rewards (
  family_id uuid not null references public.families(id) on delete cascade,
  day text not null check (day in ('viernes','sabado','domingo')),
  min_stars int not null default 0,
  emoji text not null default '🎮',
  label text not null default 'Jugar a la tablet',
  primary key (family_id, day)
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_members_family  on public.family_members(family_id);
create index if not exists idx_children_family on public.children(family_id);
create index if not exists idx_tpl_child_wd    on public.task_templates(child_id, weekday);
create index if not exists idx_comp_child      on public.completions(child_id, date);
create index if not exists idx_comp_tpl        on public.completions(template_id, date);
create index if not exists idx_ovr_tpl_date    on public.task_overrides(template_id, date);
create index if not exists idx_extra_child     on public.extra_tasks(child_id, date);
create index if not exists idx_pen_child       on public.penalties(child_id, date);

-- ============================================================
-- FUNCIONES AUXILIARES (seguras: se ejecutan como superusuario
-- pero solo devuelven datos del propio usuario)
-- ============================================================

-- ¿Es este usuario administrador?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ¿A qué familia pertenece este usuario? (null si a ninguna)
create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.family_members where user_id = auth.uid() limit 1;
$$;

-- ¿Tiene cuenta de papás (con permiso de escritura)?
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

-- ============================================================
-- SEGURIDAD (RLS): cada familia solo ve LO SUYO
-- ============================================================

alter table public.admins         enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.children       enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_overrides enable row level security;
alter table public.completions    enable row level security;
alter table public.extra_tasks    enable row level security;
alter table public.penalties      enable row level security;
alter table public.rewards        enable row level security;

-- admins
create policy "admins_select" on public.admins for select to authenticated using (is_admin());
create policy "admins_write"  on public.admins for all   to authenticated using (is_admin()) with check (is_admin());

-- families
create policy "families_select" on public.families for select to authenticated
  using (is_admin() or exists (select 1 from public.family_members m where m.family_id = families.id and m.user_id = auth.uid()));
create policy "families_write"  on public.families for all to authenticated
  using (is_admin()) with check (is_admin());

-- family_members
create policy "members_select" on public.family_members for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "members_write"  on public.family_members for all to authenticated
  using (is_admin()) with check (is_admin());

-- children
create policy "children_select" on public.children for select to authenticated
  using (family_id = my_family() or is_admin());
create policy "children_write"  on public.children for all to authenticated
  using ((is_parent() and family_id = my_family()) or is_admin())
  with check ((is_parent() and family_id = my_family()) or is_admin());

-- task_templates
create policy "templates_select" on public.task_templates for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "templates_write"  on public.task_templates for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

-- completions
create policy "completions_select" on public.completions for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "completions_write"  on public.completions for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

-- extra_tasks
create policy "extras_select" on public.extra_tasks for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "extras_write"  on public.extra_tasks for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

-- penalties
create policy "penalties_select" on public.penalties for select to authenticated
  using (is_admin() or exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family()));
create policy "penalties_write"  on public.penalties for all to authenticated
  using ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.children c where c.id = child_id and c.family_id = my_family())) or is_admin());

-- task_overrides
create policy "overrides_select" on public.task_overrides for select to authenticated
  using (is_admin() or exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                where t.id = template_id and c.family_id = my_family()));
create policy "overrides_write"  on public.task_overrides for all to authenticated
  using ((is_parent() and exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                  where t.id = template_id and c.family_id = my_family())) or is_admin())
  with check ((is_parent() and exists (select 1 from public.task_templates t join public.children c on c.id = t.child_id
                                      where t.id = template_id and c.family_id = my_family())) or is_admin());

-- rewards (por familia)
create policy "rewards_select" on public.rewards for select to authenticated
  using (family_id = my_family() or is_admin());
create policy "rewards_write"  on public.rewards for all to authenticated
  using ((is_parent() and family_id = my_family()) or is_admin())
  with check ((is_parent() and family_id = my_family()) or is_admin());

-- (El email del administrador ya se sembró arriba con el INSERT)
