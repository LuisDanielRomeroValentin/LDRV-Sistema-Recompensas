-- ============================================================
-- DIAGNÓSTICO · Misión Estrellas
-- Ejecuta este archivo en el SQL Editor de Supabase y comprueba
-- que cada consulta devuelve lo que indica su comentario.
-- (Se puede ejecutar tantas veces como quieras: solo lee datos)
-- ============================================================

-- 1️⃣ TABLAS CREADAS (esperas 10 filas)
select table_name as tabla
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
-- Debe salir EXACTAMENTE:
--   admins, children, completions, extra_tasks, families,
--   family_members, penalties, rewards, task_overrides, task_templates

-- 2️⃣ SEGURIDAD (RLS) ACTIVA EN TODAS (esperas "t" en todas las filas)
select c.relname as tabla, c.relrowsecurity as rls_activa
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
-- rls_activa debe ser "t" (true) en TODAS. Si alguna sale "f",
-- ejecuta de nuevo schema.sql completo.

-- 3️⃣ POLÍTICAS DE SEGURIDAD (esperas ~21 filas)
select tablename as tabla, policyname as politica
from pg_policies
where schemaname = 'public'
order by tablename;
-- Verás políticas como "children_select", "children_write",
-- "families_select", "admins_write"... Si sale 0 filas, falta
-- ejecutar schema.sql (o migracion-multifamilia.sql).

-- 4️⃣ FUNCIONES AUXILIARES (esperas 3 filas)
select p.proname as funcion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_admin','my_family','is_parent');
-- Deben salir las 3: is_admin, is_parent, my_family

-- 5️⃣ TU EMAIL COMO ADMINISTRADOR (esperas 1 fila con TU email)
select * from public.admins;
-- ¿0 filas? Este es el fallo más común. Ejecuta esto cambiando
-- el email por el tuyo EXACTO (el mismo de Authentication → Users):
--
-- insert into public.admins (email) values ('tu@email.com')
-- on conflict do nothing;

-- 6️⃣ TU USUARIO DE ACCESO (esperas 1 fila, con email_confirmed_at relleno)
select email, email_confirmed_at, created_at
from auth.users
order by created_at;
-- email_confirmed_at con FECHA = cuenta lista para entrar.
-- ¿0 filas? → Authentication → Users → Add user (con Auto Confirm).
-- ¿email_confirmed_at NULL? → bórrala y créala de nuevo con Auto Confirm.

-- 7️⃣ FAMILIAS Y CUENTAS (al principio: 0 filas, es normal)
select f.name as familia, m.role as rol, u.email
from public.families f
left join public.family_members m on m.family_id = f.id
left join auth.users u on u.id = m.user_id
order by f.created_at, m.role;
-- Después de crear familias desde el panel 🛠️ verás una fila por
-- cuenta: familia + rol (parent/kids) + email.

-- 8️⃣ HIJOS Y RECOMPENSAS (0 al principio; se rellenan al usar la app)
select (select count(*) from public.children) as hijos,
       (select count(*) from public.rewards) as recompensas,
       (select count(*) from public.task_templates) as tareas,
       (select count(*) from public.completions) as marcas;

-- 9️⃣ RESUMEN DE TODO EN UNA SOLA FILA
-- (el SQL Editor solo muestra el resultado de la última consulta,
--  por eso este resumen va al final del archivo)
-- Valores esperados:
--   tablas=10 · rls=10 · politicas=20 · funciones=3
--   admins=1 · tu_email_es_admin=1 · usuarios=1 · usuario_confirmado=1
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE')              as tablas,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity)     as rls_activas,
  (select count(*) from pg_policies where schemaname='public')            as politicas,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('is_admin','my_family','is_parent'))             as funciones,
  (select count(*) from public.admins)                                    as admins,
  (select count(*) from public.admins
     where lower(email)='luisromerovalentin@gmail.com')                   as tu_email_es_admin,
  (select count(*) from auth.users)                                       as usuarios,
  (select count(*) from auth.users
     where lower(email)='luisromerovalentin@gmail.com'
       and email_confirmed_at is not null)                                as usuario_confirmado;
