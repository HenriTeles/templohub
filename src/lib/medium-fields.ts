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
