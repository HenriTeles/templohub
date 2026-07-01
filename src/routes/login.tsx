import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/" });
      } else if (mode === "signup") {
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { nome } },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique o e-mail se solicitado.");
        nav({ to: "/" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-[oklch(0.35_0.1_280)] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary font-serif text-2xl font-bold">
            ✦
          </div>
          <CardTitle className="text-2xl">TemploHub</CardTitle>
          <CardDescription>
            {mode === "signin" && "Acesse sua conta"}
            {mode === "signup" && "Crie sua conta de dirigente"}
            {mode === "reset" && "Recuperar acesso"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link"}
            </Button>
          </form>
          <div className="mt-6 flex justify-between text-sm">
            {mode === "signin" ? (
              <>
                <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Criar conta
                </button>
                <button className="text-muted-foreground hover:underline" onClick={() => setMode("reset")}>
                  Esqueci a senha
                </button>
              </>
            ) : (
              <button
                className="text-primary hover:underline"
                onClick={() => setMode("signin")}
              >
                ← Voltar ao login
              </button>
            )}
          </div>
          <p className="mt-6 text-xs text-center text-muted-foreground">
            Ao continuar você concorda com a LGPD e políticas do TemploHub.
          </p>
          <p className="mt-2 text-xs text-center text-muted-foreground">
            <Link to="/">Voltar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
