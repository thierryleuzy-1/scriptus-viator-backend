// Formes de données — miroir exact de ce que l'artefact « Scriptus Viator — Base »
// (lu intégralement avant d'écrire ce fichier) construit et lit dans entries/PROJECT.
// Toute forme ici doit rester compatible avec normalizeEntries()/normalizeSession()/
// normalizeElement() de l'artefact, pour qu'un export/import entre les deux mondes
// reste possible.
import { z } from "zod";

// ---------- clés fixes (mêmes clés que STAGES dans l'artefact) ----------
export const PHASE_KEYS = [
  "inception",
  "gestation",
  "creation",
  "mise-au-monde",
  "post-partum",
] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

// Les six clés de phase pour les notes de coaching (les cinq étapes-témoignage +
// "naissance", qui n'a pas de session mais reçoit tout de même une note) — distinct de
// PHASE_KEYS ci-dessus, qui ne porte que les cinq étapes à sessions.
export const COACHING_PHASE_KEYS = [
  "inception",
  "gestation",
  "creation",
  "mise-au-monde",
  "post-partum",
  "naissance",
] as const;
export type CoachingPhaseKey = (typeof COACHING_PHASE_KEYS)[number];

export const REGISTRE_KEYS = ["corporel", "psychique", "emotionnel"] as const;
export const GESTE_KEYS = ["constat", "decouverte", "resistance", "discernement"] as const;
export const EXPERIENCE_PLANE_KEYS = ["physique", "psychique", "emotionnel", "intuitif"] as const;
export const PRAX_TYPE_KEYS = ["probleme", "decouverte", "apprentissage"] as const;
export const RESPONSE_KIND_KEYS = ["consentir", "commenter", "ajuster"] as const;
export const LENS_KEYS = ["poietique", "praxeologique"] as const;
export type Lens = (typeof LENS_KEYS)[number];

// ---------- manuscrit (session.manuscript) ----------
export const ManuscriptSchema = z
  .object({
    name: z.string(),
    kind: z.string(), // "image" | "audio" | "video" | "text" | "document" | "other"
    extractedText: z.string().default(""),
  })
  .nullable();

// ---------- image jointe à UN appel d'analyse (jamais persistée — voir README) ----------
export const InlineImageSchema = z
  .object({
    mediaType: z.string(), // ex. "image/png"
    dataBase64: z.string(),
  })
  .optional();

// ---------- élément d'analyse (poïétique ou praxéologique) ----------
export const ResponseSchema = z
  .object({
    kind: z.enum(RESPONSE_KIND_KEYS),
    personText: z.string().default(""),
    d: z.string(),
  })
  .nullable();

export const ElementSchema = z.object({
  id: z.string(),
  registre: z.string(),
  geste: z.string(),
  text: z.string(),
  response: ResponseSchema.optional().nullable(),
});
export type ElementT = z.infer<typeof ElementSchema>;

// ---------- session ----------
export const SessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  manuscript: ManuscriptSchema.optional().nullable(),
  temoignage: z.string().default(""),
  analysePoietique: z.array(ElementSchema).default([]),
  analysePraxeologique: z.array(ElementSchema).default([]),
});
export type SessionT = z.infer<typeof SessionSchema>;

// ---------- expérience d'écriture (checkins) ----------
export const CheckinSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  physique: z.number().min(1).max(5).optional(),
  psychique: z.number().min(1).max(5).optional(),
  emotionnel: z.number().min(1).max(5).optional(),
  intuitif: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});

// ---------- compilation de phase ----------
export const CompilationSchema = z
  .object({
    text: z.string(),
    d: z.string(),
  })
  .nullable();

// ---------- une phase-témoignage (inception..post-partum) ----------
export const PhaseEntrySchema = z.object({
  sessions: z.array(SessionSchema).default([]),
  experience: z.object({ checkins: z.array(CheckinSchema).default([]) }),
  compilation: CompilationSchema.optional().nullable(),
});

// ---------- naissance (phase 6) + experienceGlobale ----------
export const MetaAnalyseSegmentSchema = z
  .object({ text: z.string(), d: z.string() })
  .nullable();

export const OntoJournalEntrySchema = z.object({
  id: z.string(),
  t: z.string(),
  date: z.string().optional(),
});

export const NaissanceSchema = z.object({
  metaAnalyse: z.object({
    poietique: MetaAnalyseSegmentSchema.optional().nullable(),
    praxeologique: MetaAnalyseSegmentSchema.optional().nullable(),
  }),
});

export const ExperienceGlobaleSchema = z.object({
  journal: z.array(OntoJournalEntrySchema).default([]),
});

// ---------- entries complet (ce qui va dans la colonne JSONB "entries") ----------
export const EntriesSchema = z.object({
  inception: PhaseEntrySchema,
  gestation: PhaseEntrySchema,
  creation: PhaseEntrySchema,
  "mise-au-monde": PhaseEntrySchema,
  "post-partum": PhaseEntrySchema,
  naissance: NaissanceSchema,
  experienceGlobale: ExperienceGlobaleSchema,
});
export type EntriesT = z.infer<typeof EntriesSchema>;

export function blankEntries(): EntriesT {
  const blankPhase = () => ({ sessions: [], experience: { checkins: [] }, compilation: null });
  return {
    inception: blankPhase(),
    gestation: blankPhase(),
    creation: blankPhase(),
    "mise-au-monde": blankPhase(),
    "post-partum": blankPhase(),
    naissance: { metaAnalyse: { poietique: null, praxeologique: null } },
    experienceGlobale: { journal: [] },
  };
}

// ---------- PROJECT (champs répartis entre colonnes dédiées + deux colonnes
// jsonb additionnelles — stage_status / phase_text_overrides, voir schema.sql) ----------
export const ProjectMetaSchema = z.object({
  poieticTitle: z.string().min(1),
  workingTitle: z.string().optional().default(""),
  genre: z.string().optional().default(""),
  started: z.string().optional().default(""),
  authorName: z.string().optional().default(""),
  place: z.string().optional().default(""),
});

// ---------- praxéologie ----------
export const PraxeologieCreateSchema = z.object({
  slug: z.string().min(1),
  d: z.string().optional(),
  stage: z.string().nullable().optional(),
  type: z.enum(PRAX_TYPE_KEYS),
  text: z.string().min(1),
});

export const PraxeologiePatchSchema = z.object({
  slug: z.string().min(1),
  status: z.enum(["ouvert", "resolu"]),
});

// ---------- PUT /api/project ----------
export const ProjectUpdateSchema = z.object({
  slug: z.string().min(1),
  project: z.object({
    poieticTitle: z.string().min(1),
    workingTitle: z.string().optional().default(""),
    genre: z.string().optional().default(""),
    started: z.string().optional().default(""),
    authorName: z.string().optional().default(""),
    place: z.string().optional().default(""),
    stageStatus: z.record(z.string(), z.string()).optional().nullable(),
    phaseTextOverrides: z.record(z.string(), z.array(z.string())).optional().nullable(),
  }),
  entries: EntriesSchema,
});

// ---------- POST /api/project/archive | /restore ----------
export const SlugOnlySchema = z.object({ slug: z.string().min(1) });
export const RestoreSchema = z.object({ slug: z.string().min(1), projectId: z.string().min(1) });

// ---------- endpoints IA ----------
export const AnalyserSchema = z.object({
  slug: z.string().min(1),
  phaseKey: z.enum(PHASE_KEYS),
  temoignage: z.string().min(1),
  image: InlineImageSchema,
});

export const CompilationSyntheseSchema = z.object({
  slug: z.string().min(1),
  phaseKey: z.enum(PHASE_KEYS),
  // lignes déjà formées côté client (mêmes lignes que generateCompilation() construit
  // dans l'artefact Base — voir lib/prompts.ts) : une par élément répondu.
  lignes: z.array(z.string()).min(1),
});

export const MetaAnalyseSchema = z.object({
  slug: z.string().min(1),
  lens: z.enum(LENS_KEYS),
  lignes: z.array(z.string()).min(1),
});

export const OntoAmorceSchema = z.object({
  slug: z.string().min(1),
  materiau: z.string().min(1),
  tronque: z.boolean().optional().default(false),
});

// ---------- admin ----------
export const AdminCreatePersonSchema = z.object({
  displayName: z.string().min(1),
});

// ---------- PUT /api/admin/coaching-notes ----------
export const CoachingNoteUpsertSchema = z.object({
  slug: z.string().min(1),
  phaseKey: z.enum(COACHING_PHASE_KEYS),
  text: z.string(),
});
