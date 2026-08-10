import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "super_admin" | "admin" | "secretario" | "consulta";

type ProfileRow = {
  id: string;
  templo_id: string | null;
  nome: string | null;
  email: string | null;
};

type RoleRow = {
  role: Role;
  templo_id: string | null;
};

export const getCurrentSessionData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    // Authentication is validated by requireSupabaseAuth. Account bootstrap then
    // uses the server-only client so login never depends on RLS helper EXECUTE
    // grants. RLS remains authoritative for normal application data access.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = supabaseAdmin;
    const email = typeof context.claims?.email === "string" ? context.claims.email : null;
    const fallbackName = email?.split("@")[0] || "usuario";

    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, templo_id, nome, email")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    let restoredFromOldProfile = false;

    // Migração externa pode recriar usuários do Auth com UUID novo, mantendo
    // profiles/user_roles com o UUID antigo. Reconciliamos pelo e-mail autenticado,
    // inclusive quando o trigger já criou um perfil vazio no UUID novo.
    if (email) {
      const restored = await (async () => {
        const { data: sameEmailProfiles, error: emailProfileError } = await supabase
          .from("profiles")
          .select("id, templo_id, nome, email")
          .ilike("email", email)
          .limit(10);
        if (emailProfileError) throw new Error(emailProfileError.message);

        const oldProfile = ((sameEmailProfiles ?? []) as ProfileRow[])
          .filter((row) => row.id !== userId)
          .sort((a, b) => Number(Boolean(b.templo_id)) - Number(Boolean(a.templo_id)))[0];

        if (!oldProfile || profile?.templo_id || oldProfile.id === userId) return false;

        const { data: oldRoles, error: oldRolesError } = await supabase
          .from("user_roles")
          .select("role, templo_id")
          .eq("user_id", oldProfile.id);
        if (oldRolesError) throw new Error(oldRolesError.message);

        const rolesToRestore = ((oldRoles ?? []) as RoleRow[]).map((role) => ({
          user_id: userId,
          role: role.role,
          templo_id: role.templo_id,
        }));

        if (rolesToRestore.length > 0) {
          const { error: restoreRolesError } = await supabase
            .from("user_roles")
            .upsert(rolesToRestore, { ignoreDuplicates: true });
          if (restoreRolesError) throw new Error(restoreRolesError.message);

          const { error: deleteOldRolesError } = await supabase.from("user_roles").delete().eq("user_id", oldProfile.id);
          if (deleteOldRolesError) throw new Error(deleteOldRolesError.message);
        }

        const { error: moveProfileError } = await supabase
          .from("profiles")
          .update({ id: userId, email, nome: oldProfile.nome ?? fallbackName })
          .eq("id", oldProfile.id);

        if (moveProfileError) {
          const { error: upsertProfileError } = await supabase.from("profiles").upsert({
            id: userId,
            email,
            nome: oldProfile.nome ?? fallbackName,
            templo_id: oldProfile.templo_id,
          });
          if (upsertProfileError) throw new Error(upsertProfileError.message);
          await supabase.from("profiles").delete().eq("id", oldProfile.id);
        }
        return true;
      });
      restoredFromOldProfile = restored === true;
    }

    ({ data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, templo_id, nome, email")
      .eq("id", userId)
      .maybeSingle());
    if (profileError) throw new Error(profileError.message);

    if (!profile && !restoredFromOldProfile) {
      const { error: createProfileError } = await supabase.from("profiles").upsert({
        id: userId,
        email,
        nome: fallbackName,
      });
      if (createProfileError) throw new Error(createProfileError.message);

      const { data: createdProfile, error: createdProfileError } = await supabase
        .from("profiles")
        .select("id, templo_id, nome, email")
        .eq("id", userId)
        .maybeSingle();
      if (!createdProfileError) profile = createdProfile;
    }

    let { data: roleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, templo_id")
      .eq("user_id", userId);
    if (rolesError) throw new Error(rolesError.message);

    const roles = Array.from(new Set(((roleRows ?? []) as RoleRow[]).map((row) => row.role)));
    const isSuperAdmin = roles.includes("super_admin");
    const roleTemploId = ((roleRows ?? []) as RoleRow[]).find((row) => row.templo_id)?.templo_id ?? null;
    const temploId = (profile as ProfileRow | null)?.templo_id ?? roleTemploId;

    if (!profile) {
      profile = { id: userId, templo_id: roleTemploId, nome: fallbackName, email };
    }

    if (profile && !profile.templo_id && roleTemploId && !isSuperAdmin) {
      const { error: syncProfileError } = await supabase
        .from("profiles")
        .update({ templo_id: roleTemploId })
        .eq("id", userId);
      if (syncProfileError) throw new Error(syncProfileError.message);
      profile = { ...(profile as ProfileRow), templo_id: roleTemploId };
    }

    let templo = null;
    if (temploId && !isSuperAdmin) {
      const { data: temploRow, error: temploError } = await supabase
        .from("templos")
        .select("id, nome, status, logo_path, theme_primary, theme_accent, theme_sidebar")
        .eq("id", temploId)
        .maybeSingle();
      if (temploError) throw new Error(temploError.message);
      if (!temploRow) throw new Error("Templo vinculado não encontrado.");
      templo = temploRow;
    }

    return {
      profile: profile as ProfileRow | null,
      roles,
      templo,
    };
  });