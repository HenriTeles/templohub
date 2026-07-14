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
    const supabase = context.supabase;
    const email = typeof context.claims?.email === "string" ? context.claims.email : null;
    const fallbackName = email?.split("@")[0] || "usuario";

    const runWithAdmin = async <T,>(operation: (client: typeof supabase) => Promise<T>) => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return await operation(supabaseAdmin as unknown as typeof supabase);
      } catch (error) {
        // A sessão não deve depender da service role. O admin client é usado
        // apenas como fallback de reconciliação pós-migração; login normal usa
        // o cliente autenticado e as políticas RLS do Supabase externo.
        console.warn("[Session] Admin fallback indisponível; usando dados via RLS.", error);
        return null;
      }
    };

    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, templo_id, nome, email")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      const adminProfile = await runWithAdmin((client) =>
        client.from("profiles").select("id, templo_id, nome, email").eq("id", userId).maybeSingle(),
      );
      if (adminProfile?.error) throw new Error(adminProfile.error.message);
      profile = adminProfile?.data ?? null;
    }

    let restoredFromOldProfile = false;

    // Migração externa pode recriar usuários do Auth com UUID novo, mantendo
    // profiles/user_roles com o UUID antigo. Reconciliamos pelo e-mail autenticado,
    // inclusive quando o trigger já criou um perfil vazio no UUID novo.
    if (email) {
      const restored = await runWithAdmin(async (client) => {
        const { data: sameEmailProfiles, error: emailProfileError } = await client
          .from("profiles")
          .select("id, templo_id, nome, email")
          .ilike("email", email)
          .limit(10);
        if (emailProfileError) throw new Error(emailProfileError.message);

        const oldProfile = ((sameEmailProfiles ?? []) as ProfileRow[])
          .filter((row) => row.id !== userId)
          .sort((a, b) => Number(Boolean(b.templo_id)) - Number(Boolean(a.templo_id)))[0];

        if (!oldProfile || profile?.templo_id || oldProfile.id === userId) return false;

        const { data: oldRoles, error: oldRolesError } = await client
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
          const { error: restoreRolesError } = await client
            .from("user_roles")
            .upsert(rolesToRestore, { ignoreDuplicates: true });
          if (restoreRolesError) throw new Error(restoreRolesError.message);

          const { error: deleteOldRolesError } = await client.from("user_roles").delete().eq("user_id", oldProfile.id);
          if (deleteOldRolesError) throw new Error(deleteOldRolesError.message);
        }

        const { error: moveProfileError } = await client
          .from("profiles")
          .update({ id: userId, email, nome: oldProfile.nome ?? fallbackName })
          .eq("id", oldProfile.id);

        if (moveProfileError) {
          const { error: upsertProfileError } = await client.from("profiles").upsert({
            id: userId,
            email,
            nome: oldProfile.nome ?? fallbackName,
            templo_id: oldProfile.templo_id,
          });
          if (upsertProfileError) throw new Error(upsertProfileError.message);
          await client.from("profiles").delete().eq("id", oldProfile.id);
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
    if (profileError) {
      const adminProfile = await runWithAdmin((client) =>
        client.from("profiles").select("id, templo_id, nome, email").eq("id", userId).maybeSingle(),
      );
      if (adminProfile?.error) throw new Error(adminProfile.error.message);
      profile = adminProfile?.data ?? null;
    }

    if (!profile && !restoredFromOldProfile) {
      const { error: createProfileError } = await supabase.from("profiles").upsert({
        id: userId,
        email,
        nome: fallbackName,
      });
      if (createProfileError) {
        await runWithAdmin((client) =>
          client.from("profiles").upsert({
            id: userId,
            email,
            nome: fallbackName,
          }),
        );
      }

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
    if (rolesError) {
      const adminRoles = await runWithAdmin((client) =>
        client.from("user_roles").select("role, templo_id").eq("user_id", userId),
      );
      if (adminRoles?.error) throw new Error(adminRoles.error.message);
      roleRows = adminRoles?.data ?? [];
    }

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
      if (syncProfileError) {
        await runWithAdmin((client) => client.from("profiles").update({ templo_id: roleTemploId }).eq("id", userId));
      }
      profile = { ...(profile as ProfileRow), templo_id: roleTemploId };
    }

    let templo = null;
    if (temploId && !isSuperAdmin) {
      const { data: temploRow, error: temploError } = await supabase
        .from("templos")
        .select("id, nome, status, logo_path, theme_primary, theme_accent, theme_sidebar")
        .eq("id", temploId)
        .maybeSingle();
      if (temploError) {
        const adminTemplo = await runWithAdmin((client) =>
          client
            .from("templos")
            .select("id, nome, status, logo_path, theme_primary, theme_accent, theme_sidebar")
            .eq("id", temploId)
            .maybeSingle(),
        );
        if (adminTemplo?.error) throw new Error(adminTemplo.error.message);
        templo = adminTemplo?.data ?? null;
      } else {
        templo = temploRow;
      }
    }

    return {
      profile: profile as ProfileRow | null,
      roles,
      templo,
    };
  });