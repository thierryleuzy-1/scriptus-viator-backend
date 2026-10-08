// Prompts — copiés mot pour mot depuis l'artefact « Scriptus Viator — Base »
// (lu intégralement avant d'écrire ce fichier : fonctions generateAnalyse(),
// generateCompilation(), generatePhaseText(), generateMetaAnalyse(),
// generateOntoAmorce()). Ne rien reformuler ici — toute dérive de ton ou de
// contenu casserait la cohérence attendue par Thierry entre les deux mondes.
import { REGISTRES, GESTES, stageLabelWithSubtitle } from "./stages";

const REGISTRE_LIST = REGISTRES.map((r) => `${r.key} (${r.label})`).join(", ");
const GESTE_LIST = GESTES.map((g) => `${g.key} (${g.label})`).join(", ");

// ---- analyse phénoménologique d'UNE session (poïétique + praxéologique) ----
export function analysePrompt(opts: { phaseKey: string; temoignage: string; truncated: boolean; hasImage: boolean }): string {
  const s = stageLabelWithSubtitle(opts.phaseKey);
  return (
    "Tu lis le témoignage d'UNE session d'écriture-création, à l'étape « " + s + " » d'un processus poïétique de création. " +
    "Cette matière est brute : ce qui a été écrit pour cette seule session, sans classement.\n\n" +
    "Ta tâche : proposer DEUX lectures distinctes de ce texte.\n" +
    "1) Une lecture poïétique — ce qui se fabrique dans l'œuvre-vie en train de se faire, ce que l'expérience donne à sentir. Jamais une description ou un résumé des événements.\n" +
    "2) Une lecture praxéologique — ce que ce même texte apprend sur la manière de faire, de fonctionner, de s'y prendre : un motif, une méthode qui se précise.\n" +
    "Chaque observation, dans les deux lectures, doit être courte (1 à 3 phrases), concrète, ancrée dans le matériau, et formulée comme un objet provocateur — une proposition à discerner, jamais un verdict définitif ni un jugement de valeur.\n\n" +
    "Structure chaque observation selon deux axes :\n- registre (l'une de ces clés exactement : " + REGISTRE_LIST + ")\n- geste (l'une de ces clés exactement : " + GESTE_LIST + ")\n\n" +
    'Réponds avec UNIQUEMENT un objet JSON de la forme {"poietique": [ {"registre":string,"geste":string,"text":string}, ... 3 à 6 éléments ], "praxeologique": [ {"registre":string,"geste":string,"text":string}, ... 2 à 4 éléments ]}, rien d\'autre.' +
    (opts.hasImage
      ? "\n\nLe manuscrit déposé pour cette session est une image, jointe à ce message : regarde-la et laisse-la nourrir ta lecture, au même titre que le texte."
      : "") +
    "\n\nTémoignage de la session :\n\n" + opts.temoignage +
    (opts.truncated ? "\n\n[témoignage tronqué ici — il y en avait davantage]" : "")
  );
}

// ---- compilation de phase (synthèse phénoménologique) ----
export function compilationPrompt(opts: { phaseKey: string; lignes: string[] }): string {
  const s = stageLabelWithSubtitle(opts.phaseKey);
  return (
    "Rédige une courte synthèse phénoménologique (un ou deux paragraphes, environ 120 à 220 mots), à la première personne, dans un registre littéraire et réflexif — jamais un résumé factuel ni une liste. " +
    "Le texte compile les traces auto-poïétiques ci-dessous, issues des deux lectures de l'analyse de cette étape — poïétique et praxéologique : à chaque fois, ce qui compte est ce que la personne a fait sien (par un consentement, un commentaire ou un ajustement), pas la proposition initiale en elle-même.\n\n" +
    "Exemple du ton recherché (contenu à ignorer, seul le registre stylistique importe) : « Ce qui a commencé par une marche n'avait pas de nom, et c'est peut-être ce qui l'a rendu possible. »\n\n" +
    "Étape : " + s + "\n\nTraces auto-poïétiques :\n" + opts.lignes.join("\n") + "\n\nRéponds avec uniquement le texte de la compilation, sans titre ni préambule."
  );
}

// ---- texte explicatif d'une étape ("Comprendre cette étape") ----
export function phaseTextPrompt(opts: { phaseKey: string }): string {
  const s = stageLabelWithSubtitle(opts.phaseKey);
  return (
    "Rédige un court texte explicatif (2 à 3 paragraphes brefs), dans un registre neurophénoménologique et réflexif, expliquant l'étape « " + s + " » d'un processus poïétique de création. " +
    "Le ton : dense, conceptuel mais concret, impersonnel — jamais un conseil pratique ni une liste à puces.\n\n" +
    "Réponds avec uniquement le texte, en paragraphes séparés par une ligne vide, sans titre ni préambule."
  );
}

// ---- méta-analyse phénoménologique (phase 6), un segment par lens ----
export function metaAnalysePrompt(opts: { lens: "poietique" | "praxeologique"; lignes: string[] }): string {
  const lensLabel = opts.lens === "poietique" ? "poïétique" : "praxéologique";
  const focusLine =
    opts.lens === "poietique"
      ? "Le fil à suivre est poïétique : ce que l'ensemble du cycle a donné à sentir, la trajectoire vécue plus que ce qu'elle enseigne."
      : "Le fil à suivre est praxéologique : ce que l'ensemble du cycle apprend sur la manière de faire, les motifs qui se répètent d'une étape à l'autre, une méthode qui se précise.";
  return (
    "Rédige une méta-analyse " + lensLabel + " (deux à quatre courts paragraphes, 150 à 280 mots), à la première personne, dans un registre littéraire et réflexif, qui relit l'ensemble des cinq étapes d'un cycle poïétique de création — de l'Inception au Post-Partum — à travers les traces auto-poïétiques ci-dessous, toutes déjà consenties, commentées ou ajustées par la personne. " +
    focusLine + " Jamais un résumé étape par étape : une seule lecture d'ensemble, transversale.\n\n" +
    "Traces auto-poïétiques (les cinq étapes, dans l'ordre) :\n" + opts.lignes.join("\n") + "\n\nRéponds avec uniquement le texte, sans titre ni préambule."
  );
}

// ---- amorce ontologique (phase 6, "Du potentiel à l'incarnation") ----
export function ontoAmorcePrompt(opts: { materiau: string; tronque: boolean }): string {
  return (
    "Tu lis la matière écrite à l'étape « Inception » (l'émergence de l'idée) d'un processus poïétique de création — l'impulsion initiale, avant que le projet ne prenne forme.\n\n" +
    "Ta tâche : proposer une amorce (2 à 4 phrases, à la première personne, registre littéraire et réflexif — jamais un résumé factuel) pour nommer le désir ontologique initial qui semble avoir porté ce projet : ce que la personne cherchait, en germe, avant même de savoir ce qu'elle créait — et vers quel état d'incarnation ce désir tendait. Une hypothèse à discerner, jamais un verdict : la personne pourra la reprendre telle quelle, la corriger, ou la réécrire entièrement.\n\n" +
    "Matière d'Inception (du plus ancien au plus récent) :\n\n" + opts.materiau +
    (opts.tronque ? "\n\n[matière tronquée ici — il y en avait davantage]" : "") +
    "\n\nRéponds avec uniquement le texte de l'amorce, sans titre ni préambule."
  );
}

// ---- construit une ligne "— [lens · registre / geste] texte (trace)" — même
// forme que generateCompilation()/generateMetaAnalyse() dans l'artefact Base.
export function traceLine(opts: {
  labelPrefix: string; // lensLabel (compilation) OU stageDisplayName (méta-analyse)
  registreLabel: string;
  gesteLabel: string;
  text: string;
  responseKind: "consentir" | "commenter" | "ajuster";
  personText: string;
  variant: "compilation" | "meta";
}): string {
  let trace: string;
  if (opts.variant === "compilation") {
    trace =
      opts.responseKind === "consentir"
        ? "(la personne a consenti tel quel)"
        : opts.responseKind === "commenter"
        ? `(commentaire de la personne : « ${opts.personText} »)`
        : `(la personne a ajusté, dans ses propres mots : « ${opts.personText} »)`;
  } else {
    trace =
      opts.responseKind === "consentir"
        ? "(consenti tel quel)"
        : opts.responseKind === "commenter"
        ? `(commentaire : « ${opts.personText} »)`
        : `(ajusté, dans ses propres mots : « ${opts.personText} »)`;
  }
  return `— [${opts.labelPrefix} · ${opts.registreLabel} / ${opts.gesteLabel}] ${opts.text} ${trace}`;
}
