// Constants and helpers for the fixed médium form.

export type Sexo = "masculino" | "feminino";

export const FALANGES_MISSIONARIAS_FEM = [
  "Nityama",
  "Nityama Madruxa",
  "Samaritana",
  "Grega",
  "Maya",
  "Yuricy",
  "Yuricy Lua",
  "Dharman-Oxinto",
  "Muruaicy",
  "Jaçanã",
  "Ariana da Estrela",
  "Testemunha",
  "Madalena de Cássia",
  "Franciscana",
  "Narayama",
  "Rochana",
  "Cayçara",
  "Tupinambás",
  "Cigana Aganara",
  "Cigana Tagana",
  "Agulha Ismênia",
  "Nyatra",
] as const;

export const FALANGES_MISSIONARIAS_MASC = ["Mago", "Príncipe Maya"] as const;

export const FALANGES_JANDA = ["Yuricy", "Yuricy Lua"] as const;

export const TURNOS_MASC = ["Reili", "Dubali"] as const;
export const TURNOS_FEM = ["Doragana", "Sabarana"] as const;

export const TURNOS_TRABALHO = [
  "Adelanos", "Adonares", "Aganaros", "Ajouros", "Amoros",
  "Galero", "Gramouros", "Maturos", "Muranos", "Savanos",
  "Valúrios", "Venário", "Venário especial", "Vogues",
] as const;

export const CLASSES_ELEVACAO_MASC = [
  { v: "mestre_lua", l: "Mestre Lua" },
  { v: "mestre_sol", l: "Mestre Sol" },
] as const;

export const CLASSES_ELEVACAO_FEM = [
  { v: "ninfa_lua", l: "Ninfa Lua" },
  { v: "ninfa_sol", l: "Ninfa Sol" },
] as const;

export function classesElevacaoFor(sexo: Sexo | null | undefined) {
  if (sexo === "masculino") return CLASSES_ELEVACAO_MASC;
  if (sexo === "feminino") return CLASSES_ELEVACAO_FEM;
  return [] as ReadonlyArray<{ v: string; l: string }>;
}

export function falangesMissionariasFor(sexo: Sexo | null | undefined) {
  if (sexo === "masculino") return FALANGES_MISSIONARIAS_MASC;
  if (sexo === "feminino") return FALANGES_MISSIONARIAS_FEM;
  return [] as ReadonlyArray<string>;
}

export function turnosFor(sexo: Sexo | null | undefined) {
  if (sexo === "masculino") return TURNOS_MASC;
  if (sexo === "feminino") return TURNOS_FEM;
  return [] as ReadonlyArray<string>;
}

/**
 * Validação compartilhada (tela + servidor) das combinações válidas entre
 * sexo, falange missionária, turno, classe de elevação e Janda.
 * Não altera regras: apenas reutiliza os helpers acima.
 * Retorna a lista de mensagens de erro (vazia = válido).
 */
export function validateMediumDoutrina(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const sexoRaw = payload.sexo;
  const sexo = (sexoRaw === "masculino" || sexoRaw === "feminino" ? sexoRaw : null) as Sexo | null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
  const falange = str(payload.falange_missionaria);
  const turno = str(payload.turno);
  const classe = str(payload.classe_elevacao);
  const turnoTrabalho = str(payload.turno_trabalho);
  const janda = payload.janda;

  if (!sexo) {
    if (falange || turno || classe) {
      errors.push("Informe o sexo do médium antes de definir falange missionária, turno ou classe de elevação.");
    }
  } else {
    if (falange && !(falangesMissionariasFor(sexo) as ReadonlyArray<string>).includes(falange)) {
      errors.push(`Falange missionária "${falange}" não é válida para o sexo ${sexo}.`);
    }
    if (turno && !(turnosFor(sexo) as ReadonlyArray<string>).includes(turno)) {
      errors.push(`Turno "${turno}" não é válido para o sexo ${sexo}.`);
    }
    if (classe && !classesElevacaoFor(sexo).some((c) => c.v === classe)) {
      errors.push(`Classe de elevação "${classe}" não é válida para o sexo ${sexo}.`);
    }
  }

  if (turnoTrabalho && !(TURNOS_TRABALHO as ReadonlyArray<string>).includes(turnoTrabalho)) {
    errors.push(`Turno de trabalho "${turnoTrabalho}" não é uma opção válida.`);
  }

  const jandaAplica = sexo === "feminino" && !!falange && (FALANGES_JANDA as ReadonlyArray<string>).includes(falange);
  if (janda === true && !jandaAplica) {
    errors.push('O campo "Janda" só se aplica a médiuns do sexo feminino das falanges Yuricy ou Yuricy Lua.');
  }

  return errors;
}
