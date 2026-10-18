-- ============================================================
-- MISIÓN ESTRELLAS · Esquema para Supabase
-- Instrucciones: copia TODO este archivo, pégalo en el SQL Editor
-- de Supabase (nueva consulta) y pulsa RUN.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Hijos de la familia
-- ------------------------------------------------------------
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
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
-- Recompensas: una fila por día (viernes / sábado / domingo)
-- ------------------------------------------------------------
create table if not exists public.rewards (
  day text primary key check (day in ('viernes','sabado','domingo')),
  min_stars int not null default 0,
  emoji text not null default '🎮',
  label text not null default 'Jugar a la tablet'
);

insert into public.rewards (day, min_stars, emoji, label) values
  ('viernes', 8,  '🎮', 'Jugar a la tablet'),
  ('sabado',  10, '🕹️', 'Tiempo extra de tablet'),
  ('domingo', 12, '📺', 'Película + tablet')
on conflict (day) do nothing;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_tpl_child_wd   on public.task_templates(child_id, weekday);
create index if not exists idx_comp_child     on public.completions(child_id, date);
create index if not exists idx_comp_tpl       on public.completions(template_id, date);
create index if not exists idx_ovr_tpl_date   on public.task_overrides(template_id, date);
create index if not exists idx_extra_child    on public.extra_tasks(child_id, date);
create index if not exists idx_pen_child      on public.penalties(child_id, date);

-- ============================================================
-- SEGURIDAD (RLS)
-- Cualquiera con la URL puede LEER (los hijos ven todo),
-- pero solo quien haya iniciado sesión como padres puede ESCRIBIR.
-- ============================================================

alter table public.children        enable row level security;
alter table public.task_templates  enable row level security;
alter table public.task_overrides  enable row level security;
alter table public.completions     enable row level security;
alter table public.extra_tasks     enable row level security;
alter table public.penalties       enable row level security;
alter table public.rewards         enable row level security;

-- Lectura pública (hijos)
create policy "lectura children"        on public.children        for select using (true);
create policy "lectura templates"       on public.task_templates  for select using (true);
create policy "lectura overrides"       on public.task_overrides  for select using (true);
create policy "lectura completions"     on public.completions     for select using (true);
create policy "lectura extras"          on public.extra_tasks     for select using (true);
create policy "lectura penalties"       on public.penalties       for select using (true);
create policy "lectura rewards"         on public.rewards         for select using (true);

-- Escritura solo para padres (usuarios autenticados)
create policy "escritura children"      on public.children        for all to authenticated using (true) with check (true);
create policy "escritura templates"     on public.task_templates  for all to authenticated using (true) with check (true);
create policy "escritura overrides"     on public.task_overrides  for all to authenticated using (true) with check (true);
create policy "escritura completions"   on public.completions     for all to authenticated using (true) with check (true);
create policy "escritura extras"        on public.extra_tasks     for all to authenticated using (true) with check (true);
create policy "escritura penalties"     on public.penalties       for all to authenticated using (true) with check (true);
create policy "escritura rewards"       on public.rewards         for all to authenticated using (true) with check (true);
