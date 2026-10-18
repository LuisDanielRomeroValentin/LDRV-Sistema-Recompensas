# ⭐ Misión Estrellas (multi-familias)

Sistema de tareas y recompensas para peques de la casa, funcionando **sin Google Apps Script ni Google Sheets**:

- **GitHub Pages** aloja la aplicación (gratis).
- **Supabase** guarda los datos (base de datos PostgreSQL + usuarios, gratis).
- **Tú eres el administrador**: das de alta a otras familias desde la app, y cada familia usa su propia cuenta.
- Cada familia **solo ve a sus hijos**: el filtrado no está en la web, está en el servidor (Supabase RLS), así que aunque alguien abra el código o las herramientas de desarrollo, no puede ver datos de otras familias.

| Rol | Qué puede hacer |
|---|---|
| 🛠️ **Administrador (tú)** | Crear familias y cuentas, borrar familias, y usar la app con tu propia familia |
| 👨‍👩‍👧 **Papás (cada familia)** | Crear hijos y tareas, marcar ✅/❌, penalizaciones, tareas extra, recompensas |
| 👧 **Niños (cuenta opcional)** | Solo mirar sus estrellas, tareas y penalizaciones. Supabase **rechaza** cualquier escritura con esta cuenta |

---

## 🧩 Paso 1 · Crear la cuenta y el proyecto de Supabase

1. Entra en **[supabase.com](https://supabase.com)** y crea una cuenta gratis (se puede con GitHub).
2. Pulsa **New project**:
   - **Name**: `mis-estrellas`
   - **Database Password**: una que recuerdes (no la usarás día a día)
   - **Region**: `West EU`
3. Espera un minuto a que el proyecto esté listo.

## 🗄️ Paso 2 · Crear las tablas

1. En el panel de Supabase entra en **SQL Editor** → **New query**.
2. Pega **todo el contenido de [`sql/schema.sql`](sql/schema.sql)** y pulsa **Run**.
   ✅ Tu email de administrador ya viene sembrado dentro de ese archivo (no hay que hacer nada más).

> ¿Ya tenías las tablas de la versión anterior (una sola familia)? En vez de `schema.sql`, ejecuta [`sql/migracion-multifamilia.sql`](sql/migracion-multifamilia.sql) (igual sustituyendo tu email al final).

## 🔑 Paso 3 · Conectar los datos a la web (config.js)

1. En Supabase: **Project Settings ⚙️** → pestaña **API**.
2. Copia en `config.js`:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`

> 🟢 La clave `anon` es pública por diseño: lo que protege los datos son las reglas RLS del `schema.sql`, que ya vienen incluidas.

## 👤 Paso 4 · Crear tu cuenta de administrador

1. En Supabase: **Authentication → Users** → **Add user**:
   - **Email**: el mismo que sembraste en el paso 2 (el de `admins`)
   - **Password**: tu contraseña personal
   - Marca **Auto Confirm User**.
2. Entra en **Authentication → Sign In / Providers → Email** y desactiva **Allow new users to sign up**.
   ⚠️ Imprescindible: si no, cualquiera podría crear cuentas por su cuenta.

## 💻 Paso 5 · Probar en local (opcional)

Abre `index.html` con doble clic. Debería cargar la portada (aún sin familias).

## 🚀 Paso 6 · Publicar en GitHub Pages

1. Sube los archivos (`git add . && git commit && git push`).
2. En el repositorio: **Settings → Pages** → Branch: `main` / `(root)` → **Save**.
3. En un minuto estará online en `https://TU-USUARIO.github.io/LDRV-Sistema-Recompensas/`

## 📱 Paso 7 · Instalarlo en los móviles

- **iPhone**: Safari → compartir → **Añadir a pantalla de inicio**.
- **Android**: Chrome → menú ⋮ → **Instalar aplicación**.

## 🛠️ Paso 8 · Desplegar la función que crea familias

La función `admin-familias` corre **dentro de Supabase** (nunca se descarga al navegador) y es la única que puede crear cuentas, usando la clave secreta de servicio. Solo la usa el administrador.

**Opción A — desde el navegador (la más fácil):**
1. En Supabase: menú **Edge Functions** → **Create a new function**.
2. Nombre: `admin-familias` (exactamente así).
3. Pega todo el contenido de [`functions/admin-familias/index.ts`](functions/admin-familias/index.ts).
4. Pulsa **Deploy**.

**Opción B — desde la terminal:**
```bash
npx supabase functions deploy admin-familias --project-ref TU_PROJECT_REF
```
(`TU_PROJECT_REF` lo ves en Settings → General → Reference ID)

---

## 🕹️ Cómo se usa

### 🛠️ Administrador (tú)
1. Entras a la web con **tu cuenta de administrador** → **Zona de papás** → botón **🛠️**.
2. **Nueva familia**: nombre, email y código de papás, y opcionalmente una cuenta de solo lectura para sus niños. La app te muestra las cuentas creadas para que se las pases a tus amigos.
3. **➕** en una familia existente: añadir más cuentas (por ejemplo, la de mamá y la de papá por separado, o la de los niños).
4. **🗑️** borra una familia y todos sus datos.
5. **➕ Crear MI familia**: la primera vez, para usar la app con tus propios hijos.

### 👨‍👩‍👧 Papás de cada familia
1. Entran con **su email y su código**.
2. **🗓️ Tareas**: marcar ✅ (gana 1 ⭐) o ❌, editar tareas (✏️ siempre / 📅 solo esa semana / 🗑️), añadir tareas y 📋 copiar la semana anterior.
3. **🎁 Extras**: tareas extra de 1-3 ⭐ para recuperar estrellas.
4. **🚫 Penalizaciones**: motivo + puntos (cada 3 puntos = 1 estrella menos, automático).
5. **🏆 Recompensas**: estrellas mínimas para tablet el viernes / sábado / domingo.
6. **👧 Hijos**: añadir hijos (nombre, animalito y color). Al crear el primer hijo aparecen las tareas por defecto.
7. Botón **🔒** para cerrar sesión (la sesión se cierra sola a los 15 min sin tocar nada). El botón 👀 deja ver cómo lo ven los hijos.

### 👧 Niños
1. Entran con **la cuenta de niños** (email + código que les disteis).
2. Ven directamente sus estrellas: tareas de lunes a viernes por categorías (🪥 Personal, 🧹 Casa, 📚 Educativo), extras, penalizaciones y barras de progreso hacia cada recompensa.
3. **No hay ningún botón de edición** y, además, Supabase rechaza cualquier escritura venga como venga con esa cuenta.

---

## ❓ Preguntas frecuentes

**¿Cuánto cuesta?** Nada. GitHub Pages y Supabase tienen planes gratuitos muy holgados (Supabase: 500.000 usuarios/mes y 500.000 invocaciones de Edge Functions: de sobra).

**¿Puede una familia ver los datos de otra?** No. Las reglas del servidor comparan la familia de la cuenta con la familia de cada fila. Es imposible saltárselo desde la web.

**¿Y si un niño se descubre la clave `anon`?** Solo sirve para leer SU familia (y con cuenta de niños, ni eso: necesita sesión de papás para escribir).

**¿Olvidaron mis amigos su código?** Tú lo eliges al crearles la cuenta, así que se lo puedes recordar; o bórrales la cuenta desde el panel 🛠️ y créales otra.

**¿Puedo ampliar mi familia a más de una cuenta?** Sí: ➕ en tu familia → crea la cuenta de mamá y la de papá por separado.

**¿Y si quiero sábados o más categorías?** Las categorías son fijas (Personal/Casa/Educativo) y los días de lunes a viernes, tal como se pidió. Se puede ampliar tocando `sql/schema.sql` y `app.js`.
