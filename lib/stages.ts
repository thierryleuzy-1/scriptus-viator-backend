// Même table STAGES que l'artefact « Scriptus Viator — Base » (noms + sous-titres
// seulement — le long texte explicatif de chaque étape reste côté client, inchangé).
export const STAGES_INFO: Record<string, { num: number; name: string; subtitle: string }> = {
  inception: { num: 1, name: "Inception", subtitle: "Émergence de l'idée" },
  gestation: { num: 2, name: "Gestation", subtitle: "Préparation du terrain" },
  creation: { num: 3, name: "Création", subtitle: "Écriture du récit" },
  "mise-au-monde": { num: 4, name: "Mise au monde", subtitle: "Actualisation du projet" },
  "post-partum": { num: 5, name: "Post-Partum", subtitle: "Le temps mort de la fin" },
  naissance: { num: 6, name: "Ce qu'il en naît", subtitle: "Nouvelle Inception" },
};

export function stageDisplayName(key: string): string {
  return STAGES_INFO[key]?.name || key;
}
export function stageSubtitle(key: string): string {
  return STAGES_INFO[key]?.subtitle || "";
}
// Reproduit stageDisplayName(s) + (s.subtitle ? " — "+s.subtitle : "") de l'artefact.
export function stageLabelWithSubtitle(key: string): string {
  const name = stageDisplayName(key);
  const sub = stageSubtitle(key);
  return sub ? `${name} — ${sub}` : name;
}

export const REGISTRES = [
  { key: "corporel", label: "Corps" },
  { key: "psychique", label: "Psyché" },
  { key: "emotionnel", label: "Intuition-Émotion" },
] as const;

export const GESTES = [
  { key: "constat", label: "Constat" },
  { key: "decouverte", label: "Découvertes" },
  { key: "resistance", label: "Nœuds à dénouer" },
  { key: "discernement", label: "Discernement" },
] as const;

export function registreLabel(key: string): string {
  return REGISTRES.find((r) => r.key === key)?.label || key;
}
export function gesteLabel(key: string): string {
  return GESTES.find((g) => g.key === key)?.label || key;
}
