export const SITUACAO_LABEL: Record<string, string> = {
  ativo: "Ativo",
  em_desenvolvimento: "Em desenvolvimento",
  afastado: "Afastado",
  desligado: "Desligado",
  licenciado: "Licenciado",
};

export function situacaoBadgeClass(s: string | null | undefined): string {
  switch (s) {
    case "ativo":
      return "bg-emerald-100 text-emerald-800";
    case "em_desenvolvimento":
      return "bg-sky-100 text-sky-800";
    case "afastado":
      return "bg-amber-100 text-amber-800";
    case "desligado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}
