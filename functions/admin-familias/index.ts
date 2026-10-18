// ============================================================
// MISIÓN ESTRELLAS · Edge Function "admin-familias"
//
// Crea familias y cuentas de acceso. Solo la puede usar la
// cuenta de administrador (la que esté en la tabla `admins`).
//
// Despliegue: mira el README.md (paso 8).
// Acciones:
//   { "action": "create-family", "name": "Familia García",
//     "parent_email": "...", "parent_password": "...",
//     "kids_email": "...", "kids_password": "..." }   (kids opcional)
//   { "action": "add-account", "family_id": "...",
//     "email": "...", "password": "...", "role": "parent" | "kids" }
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const esEmail = (m: unknown) =>
  typeof m === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);

const esPassword = (p: unknown) => typeof p === "string" && p.length >= 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // Cliente con la clave de SERVICIO (solo existe dentro de Supabase)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) ¿Quién llama? (el token del navegador)
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email) return json({ error: "No autorizado" }, 401);

  // 2) ¿Es administrador?
  const { data: adm } = await supabase
    .from("admins")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();
  if (!adm) return json({ error: "Solo el administrador puede hacer esto" }, 403);

  // 3) Datos de la petición
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Datos no válidos" }, 400);
  }

  const creaUsuario = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // cuenta confirmada: no necesita verificar email
    });
    if (error) {
      if (/already been registered/i.test(error.message)) {
        throw new Error(`Ya existe una cuenta con el email ${email}`);
      }
      throw new Error(error.message);
    }
    return data.user!.id;
  };

  const creaRewards = async (familyId: string) => {
    await supabase.from("rewards").insert([
      { family_id: familyId, day: "viernes", min_stars: 8, emoji: "🎮", label: "Jugar a la tablet" },
      { family_id: familyId, day: "sabado", min_stars: 10, emoji: "🕹️", label: "Tiempo extra de tablet" },
      { family_id: familyId, day: "domingo", min_stars: 12, emoji: "📺", label: "Película + tablet" },
    ]);
  };

  try {
    // ---------- Nueva familia ----------
    if (body.action === "create-family") {
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Falta el nombre de la familia" }, 400);
      if (!esEmail(body.parent_email) || !esPassword(body.parent_password)) {
        return json({ error: "Email de papás no válido o código corto (mínimo 6 caracteres)" }, 400);
      }

      const parentUid = await creaUsuario(String(body.parent_email), String(body.parent_password));

      const { data: fam, error: famErr } = await supabase
        .from("families").insert({ name }).select("id").single();
      if (famErr || !fam) throw new Error(famErr?.message ?? "No se pudo crear la familia");

      const { error: memErr } = await supabase
        .from("family_members")
        .insert({ user_id: parentUid, family_id: fam.id, role: "parent" });
      if (memErr) throw new Error(memErr.message);

      await creaRewards(fam.id);

      const emails = [String(body.parent_email)];

      // Cuenta opcional de solo lectura para los niños
      if (body.kids_email) {
        if (!esEmail(body.kids_email) || !esPassword(body.kids_password)) {
          return json({ error: "Email de niños no válido o código corto (mínimo 6 caracteres)" }, 400);
        }
        const kidsUid = await creaUsuario(String(body.kids_email), String(body.kids_password));
        const { error: kErr } = await supabase
          .from("family_members")
          .insert({ user_id: kidsUid, family_id: fam.id, role: "kids" });
        if (kErr) throw new Error(kErr.message);
        emails.push(String(body.kids_email));
      }

      return json({ ok: true, emails });
    }

    // ---------- Añadir otra cuenta a una familia existente ----------
    if (body.action === "add-account") {
      const familyId = String(body.family_id ?? "");
      const role = body.role === "kids" ? "kids" : "parent";
      if (!familyId) return json({ error: "Falta la familia" }, 400);
      if (!esEmail(body.email) || !esPassword(body.password)) {
        return json({ error: "Email no válido o código corto (mínimo 6 caracteres)" }, 400);
      }
      const uid = await creaUsuario(String(body.email), String(body.password));
      const { error } = await supabase
        .from("family_members")
        .insert({ user_id: uid, family_id: familyId, role });
      if (error) throw new Error(error.message);
      return json({ ok: true, emails: [String(body.email)] });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
