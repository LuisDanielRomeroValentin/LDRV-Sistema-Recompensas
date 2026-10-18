# ⭐ Misión Estrellas

Sistema de tareas y recompensas para peques de la casa, funcionando **sin Google Apps Script ni Google Sheets**:

- **GitHub Pages** aloja la aplicación (gratis).
- **Supabase** guarda los datos (base de datos PostgreSQL, gratis).
- Los **hijos** entran sin código: ven tareas, estrellas, penalizaciones y recompensas… pero **solo lectura**.
- Los **papás** entran con un **código familiar** para crear tareas, poner ✅/❌, penalizaciones, tareas extra y configurar las recompensas.

---

## 🧩 Paso 1 · Crear la cuenta y el proyecto de Supabase

1. Entra en **[supabase.com](https://supabase.com)** y crea una cuenta gratis (se puede con GitHub).
2. Pulsa **New project**:
   - **Name**: `mis-estrellas` (o el que quieras)
   - **Database Password**: pon una que recuerdes (no la usarás día a día)
   - **Region**: `West EU` (lo más cercano)
3. Espera un minuto a que el proyecto esté listo.

## 🗄️ Paso 2 · Crear las tablas

1. En el panel de Supabase, en el menú de la izquierda entra en **SQL Editor**.
2. Pulsa **New query**, pega **todo el contenido del archivo [`sql/schema.sql`](sql/schema.sql)** y pulsa **Run** (abajo a la derecha).
3. Verás `Success. No rows returned`. ¡Listo! Ya existen las tablas: hijos, tareas, penalizaciones, extras y recompensas.

## 🔑 Paso 3 · Conectar los datos a la web (config.js)

1. En Supabase, entra en **Project Settings ⚙️** (engranaje, abajo a la izquierda) → pestaña **API**.
2. Copia dos cosas:
   - **Project URL** → pécala en `config.js` en `SUPABASE_URL`
   - **anon public** (la clave larga) → pécala en `SUPABASE_ANON_KEY`

> 🟢 La clave `anon` está pensada para ser pública. Lo que impide que alguien borre datos es la **seguridad RLS** que ya viene incluida en `sql/schema.sql`: cualquiera puede LEER, pero solo quien inicie sesión como papás puede ESCRIBIR.

## 👨‍👩‍👧 Paso 4 · Crear el código de papás

1. En Supabase entra en **Authentication → Users** y pulsa **Add user** (o **Invite user**):
   - **Email**: el mismo que has puesto en `config.js` → `PADRES_EMAIL` (p. ej. `padres@misestrellas.app`; puede ser un email inventado)
   - **Password**: este será **vuestro código familiar** (p. ej. `familia2026`)
   - Marca **Auto Confirm User**.
2. Entra en **Authentication → Sign In / Providers → Email** y desactiva **Allow new users to sign up**.
   ⚠️ Esto es importante: si lo dejas activado, cualquiera podría crear una cuenta y escribir en los datos.

## 💻 Paso 5 · Probar en local (opcional)

Abre `index.html` con doble clic en el navegador. Con Supabase configurado ya funciona todo.

## 🚀 Paso 6 · Publicar en GitHub Pages

1. Sube los archivos a tu repositorio (`git add . && git commit && git push`).
2. En GitHub, entra en el repositorio → **Settings → Pages**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `(root)` → **Save**
3. En 1 minuto estará online en `https://TU-USUARIO.github.io/LDRV-Sistema-Recompensas/`

## 📱 Paso 7 · Instalarlo en los móviles

- **iPhone**: abre la web en Safari → botón compartir → **Añadir a pantalla de inicio**.
- **Android**: abre en Chrome → menú ⋮ → **Instalar aplicación**.

Así se abre como una app con pantalla completa y el icono de "Misión Estrellas".

---

## 🕹️ Cómo se usa día a día

### Los hijos (sin código)
1. Entran a la web → **Ver mis estrellas** → tocan su animalito.
2. Ven su ⭐ total, las tareas de lunes a viernes por categorías (🪥 Personal, 🧹 Casa, 📚 Educativo), sus penalizaciones y cuántas estrellas le faltan para cada recompensa del finde.

### Los papás (con código)
1. **Zona de papás** → escribís el código.
2. Pestaña **🗓️ Tareas**: elegid hijo, día y marcad ✅ (hecha, gana 1 ⭐) o ❌ (no hecha). Con ✏️ editáis la tarea **para siempre**, con 📅 solo para **esa semana**, con 🗑️ la borráis. **📋 Copiar la semana anterior** trae los cambios y extras de la semana pasada.
3. Pestaña **🎁 Extras**: tareas extra (1-3 ⭐) para recuperar estrellas perdidas.
4. Pestaña **🚫 Penalizaciones**: motivo + puntos. Cada **3 puntos = 1 estrella menos** (se calcula sola).
5. Pestaña **🏆 Recompensas**: cuántas estrellas hacen falta para tablet el **viernes**, el **sábado** y el **domingo**.
6. Pestaña **👧 Hijos**: añadir/editar hijos (nombre, animalito y color).
7. Cuando terminéis: botón **🔒** para cerrar la sesión (si los hijos usan el móvil, es importante; además la sesión se cierra sola a los 15 min sin tocar nada).

> 👀 El botón de ojitos en la zona de papás deja ver cómo lo ven los hijos.

---

## ❓ Preguntas frecuentes

**¿Cuánto cuesta?** Nada. GitHub Pages y Supabase tienen planes gratuitos muy holgados para una app familiar así.

**¿Y si olvido el código?** En Supabase: *Authentication → Users* → tu usuario → **Reset password** (o añade otro usuario). Después actualiza `PADRES_EMAIL` en `config.js` si usas otro email.

**¿Pueden los hijos tocar las estrellas?** No. La parte de escritura está protegida: Supabase solo acepta cambios de la cuenta de papás, y el modo de los hijos no tiene ningún botón de edición.

**¿Se pierden datos si cambio de móvil?** No, todo está en Supabase. Los hijos se pueden añadir desde cualquier dispositivo.

**¿Puedo cambiar las categorías o añadir más días?** Las categorías son fijas (Personal/Casa/Educativo) y los días de lunes a viernes, tal como pediste. Si algún día queréis sábados, se puede ampliar tocando el `sql/schema.sql`.
