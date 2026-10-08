// Scriptus Viator — backend multi-personnes.
// Une seule fonction serverless Express (voir vercel.json : /api/:path* -> cette fonction),
// suivant le même patron que le tout premier backend (Express + Supabase, pas d'ORM).
import express, { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { storage } from "../lib/storage";
import { generateUniqueSlug } from "../lib/slug";
import { callClaudeText, callClaudeJSON, AnthropicError } from "../lib/anthropic";
import {
  AnalyserSchema,
  CompilationSyntheseSchema,
  MetaAnalyseSchema,
  OntoAmorceSchema,
  ProjectUpdateSchema,
  SlugOnlySchema,
  RestoreSchema,
  PraxeologieCreateSchema,
  PraxeologiePatchSchema,
  AdminCreatePersonSchema,
  CoachingNoteUpsertSchema,
  REGISTRE_KEYS,
  GESTE_KEYS,
} from "../lib/types";
import { analysePrompt, compilationPrompt, phaseTextPrompt, metaAnalysePrompt, ontoAmorcePrompt } from "../lib/prompts";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "15mb" })); // une image de manuscrit jointe à /api/analyser peut être lourde

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    (req as any).validated = parsed.data;
    next();
  };
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-admin-key");
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    res.status(500).json({ error: "admin_key_not_configured", message: "ADMIN_KEY n'est pas configurée sur le serveur." });
    return;
  }
  if (!key || key !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

const UNKNOWN_SLUG_MESSAGE = "Ce lien n'est pas reconnu — demande un nouveau lien à la personne qui te l'a transmis.";

// Résout le slug — query ?p= pour les GET, champ "slug" du corps pour les
// PUT/POST/PATCH (convention documentée dans le README et dans le cahier des charges).
async function requirePerson(req: Request, res: Response): Promise<{ id: string; slug: string; displayName: string } | null> {
  const slug = (req.query.p as string) || (req.body && (req.body as any).slug);
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "missing_slug", message: "Paramètre ?p=<slug> (GET) ou champ slug (POST/PUT/PATCH) manquant." });
    return null;
  }
  const person = await storage.getPersonBySlug(slug);
  if (!person) {
    res.status(404).json({ error: "unknown_slug", message: UNKNOWN_SLUG_MESSAGE });
    return null;
  }
  return person;
}

function asyncRoute(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (err instanceof AnthropicError) {
        const statusByCode: Record<string, number> = { rate_limited: 429, missing_api_key: 500 };
        res.status(statusByCode[err.code] || 502).json({ error: err.code, message: err.message });
        return;
      }
      res.status(500).json({ error: "internal_error", message: err?.message || "Erreur interne." });
    });
  };
}

// ---------------------------------------------------------------------------
// Projet — GET /api/project, PUT /api/project, archive/restore
// ---------------------------------------------------------------------------
app.get(
  "/api/project",
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const active = await storage.ensureActiveProject(person.id);
    const archived = await storage.getArchivedProjects(person.id);
    const praxeologie = await storage.listPraxeologie(person.id);
    const coachingNotes = await storage.getCoachingNotes(person.id);
    res.json({
      person: { slug: person.slug, displayName: person.displayName },
      project: active.project,
      entries: active.entries,
      projectId: active.id,
      archivedProjects: archived.map((p) => ({
        id: p.id,
        project: p.project,
        entries: p.entries,
        archivedAt: p.archivedAt,
      })),
      praxeologie,
      // Les notes que Thierry écrit par étape (voir /api/admin/coaching-notes) — la personne
      // les lit directement dans sa propre app, sans aller-retour supplémentaire.
      coachingNotes,
    });
  })
);

app.put(
  "/api/project",
  validate(ProjectUpdateSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { project, entries } = (req as any).validated;
    const updated = await storage.updateActiveProject(
      person.id,
      {
        poieticTitle: project.poieticTitle,
        workingTitle: project.workingTitle,
        genre: project.genre,
        started: project.started,
        authorName: project.authorName,
        place: project.place,
        stageStatus: project.stageStatus ?? null,
        phaseTextOverrides: project.phaseTextOverrides ?? null,
      },
      entries
    );
    res.json({ project: updated.project, entries: updated.entries, projectId: updated.id });
  })
);

app.post(
  "/api/project/archive",
  validate(SlugOnlySchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { archived, active } = await storage.archiveActiveAndCreateNew(person.id);
    res.json({
      archived: archived ? { id: archived.id, project: archived.project, entries: archived.entries, archivedAt: archived.archivedAt } : null,
      active: { id: active.id, project: active.project, entries: active.entries },
    });
  })
);

app.post(
  "/api/project/restore",
  validate(RestoreSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { projectId } = (req as any).validated;
    const { restored, archivedPrevious } = await storage.restoreProject(person.id, projectId);
    res.json({
      restored: { id: restored.id, project: restored.project, entries: restored.entries },
      archivedPrevious: archivedPrevious
        ? { id: archivedPrevious.id, project: archivedPrevious.project, entries: archivedPrevious.entries, archivedAt: archivedPrevious.archivedAt }
        : null,
    });
  })
);

// POST /api/project/delete — suppression définitive d'un projet archivé. Choix de
// jugement : non listé dans le cahier des charges, ajouté pour conserver le bouton
// « Supprimer » du portfolio de l'artefact Base (voir lib/storage.ts).
app.post(
  "/api/project/delete",
  validate(RestoreSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { projectId } = (req as any).validated;
    const ok = await storage.deleteArchivedProject(person.id, projectId);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ deleted: true });
  })
);

// ---------------------------------------------------------------------------
// Praxéologie — globale par personne
// ---------------------------------------------------------------------------
app.get(
  "/api/praxeologie",
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const rows = await storage.listPraxeologie(person.id);
    res.json({ praxeologie: rows });
  })
);

app.post(
  "/api/praxeologie",
  validate(PraxeologieCreateSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const body = (req as any).validated;
    const row = await storage.createPraxeologie(person.id, { d: body.d, stage: body.stage, type: body.type, text: body.text });
    res.status(201).json({ entry: row });
  })
);

app.patch(
  "/api/praxeologie/:id",
  validate(PraxeologiePatchSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { status } = (req as any).validated;
    const row = await storage.patchPraxeologieStatus(person.id, req.params.id as string, status);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ entry: row });
  })
);

// ---------------------------------------------------------------------------
// Endpoints IA — un par appel sample()/sample.json() trouvé dans l'artefact Base.
// Chaque prompt est copié mot pour mot (voir lib/prompts.ts) ; seule la
// matière (témoignage, lignes déjà formées) varie, fournie par le client.
// ---------------------------------------------------------------------------

// POST /api/analyser — généère l'analyse poïétique + praxéologique d'UNE session.
// Équivalent de generateAnalyse() / sample.json(...) dans l'artefact Base.
app.post(
  "/api/analyser",
  validate(AnalyserSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const body = (req as any).validated as z.infer<typeof AnalyserSchema>;
    const CAP = 12000;
    const truncated = body.temoignage.length > CAP;
    const temoignage = truncated ? body.temoignage.slice(0, CAP) : body.temoignage;
    const prompt = analysePrompt({
      phaseKey: body.phaseKey,
      temoignage,
      truncated,
      hasImage: !!body.image,
    });
    let data: any;
    try {
      data = await callClaudeJSON(prompt, {
        image: body.image ? { mediaType: body.image.mediaType, dataBase64: body.image.dataBase64 } : undefined,
      });
    } catch (err: any) {
      if (err instanceof AnthropicError && err.code === "invalid_json") {
        // Même filet de sécurité que l'artefact Base : si le JSON n'est pas exploitable,
        // on renvoie quand même le texte brut comme UN SEUL élément poïétique.
        res.json({
          poietique: [{ registre: "psychique", geste: "constat", text: String((err as any).rawText || "").slice(0, 600) }],
          praxeologique: [],
        });
        return;
      }
      throw err;
    }
    const clean = (arr: any, max: number) =>
      (Array.isArray(arr) ? arr : [])
        .filter((o: any) => o && typeof o.text === "string" && o.text.trim())
        .slice(0, max)
        .map((o: any) => ({
          registre: REGISTRE_KEYS.includes(o.registre) ? o.registre : "psychique",
          geste: GESTE_KEYS.includes(o.geste) ? o.geste : "constat",
          text: String(o.text).trim(),
        }));
    const poietique = clean(data?.poietique, 6);
    const praxeologique = clean(data?.praxeologique, 4);
    if (poietique.length === 0 && praxeologique.length === 0) {
      res.json({
        poietique: [{ registre: "psychique", geste: "constat", text: (JSON.stringify(data) || "Réponse vide.").slice(0, 600) }],
        praxeologique: [],
      });
      return;
    }
    res.json({ poietique, praxeologique });
  })
);

// POST /api/compilation-synthese — synthèse phénoménologique d'une étape.
// Équivalent de generateCompilation() dans l'artefact Base.
app.post(
  "/api/compilation-synthese",
  validate(CompilationSyntheseSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const body = (req as any).validated as z.infer<typeof CompilationSyntheseSchema>;
    const prompt = compilationPrompt({ phaseKey: body.phaseKey, lignes: body.lignes });
    const text = await callClaudeText(prompt, { maxTokens: 900 });
    res.json({ text });
  })
);

// POST /api/texte-etape — texte explicatif d'une étape ("Comprendre cette étape").
// Équivalent de generatePhaseText() dans l'artefact Base. Cinquième appel sample()
// trouvé dans l'artefact, en plus des quatre nommés dans le cahier des charges —
// voir la note « choix de jugement » dans le résumé final.
app.post(
  "/api/texte-etape",
  validate(z.object({ slug: z.string().min(1), phaseKey: z.string().min(1) })),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const { phaseKey } = (req as any).validated;
    const prompt = phaseTextPrompt({ phaseKey });
    const text = await callClaudeText(prompt, { maxTokens: 700 });
    res.json({ text });
  })
);

// POST /api/meta-analyse — méta-analyse phénoménologique (phase 6), un segment par lens.
// Équivalent de generateMetaAnalyse() dans l'artefact Base.
app.post(
  "/api/meta-analyse",
  validate(MetaAnalyseSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const body = (req as any).validated as z.infer<typeof MetaAnalyseSchema>;
    const prompt = metaAnalysePrompt({ lens: body.lens, lignes: body.lignes });
    const text = await callClaudeText(prompt, { maxTokens: 900 });
    res.json({ text });
  })
);

// POST /api/onto-amorce — amorce du constat ontologique (phase 6).
// Équivalent de generateOntoAmorce() dans l'artefact Base.
app.post(
  "/api/onto-amorce",
  validate(OntoAmorceSchema),
  asyncRoute(async (req, res) => {
    const person = await requirePerson(req, res);
    if (!person) return;
    const body = (req as any).validated as z.infer<typeof OntoAmorceSchema>;
    const prompt = ontoAmorcePrompt({ materiau: body.materiau, tronque: body.tronque });
    const text = await callClaudeText(prompt, { maxTokens: 500 });
    res.json({ text });
  })
);

// ---------------------------------------------------------------------------
// Administration — protégée par x-admin-key (variable d'environnement ADMIN_KEY)
// ---------------------------------------------------------------------------
app.post(
  "/api/admin/persons",
  requireAdmin,
  validate(AdminCreatePersonSchema),
  asyncRoute(async (req, res) => {
    const { displayName } = (req as any).validated;
    const slug = await generateUniqueSlug(displayName);
    const person = await storage.createPerson(displayName, slug);
    res.status(201).json({ person, link: `/?p=${person.slug}` });
  })
);

app.get(
  "/api/admin/persons",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const persons = await storage.listPersonsWithStats();
    res.json({ persons });
  })
);

// GET /api/admin/person?slug=<slug> — lecture intégrale d'une personne pour admin-person.html :
// projet actif + projets archivés (même forme que GET /api/project, réutilisé tel quel) plus
// la praxéologie et les notes de coaching. Note : contrairement à requirePerson() (query ?p=
// pour les GET côté personne), le paramètre s'appelle ici "slug" — ce sont deux routes
// distinctes (admin vs personne), chacune documentée avec son propre nom de paramètre.
app.get(
  "/api/admin/person",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const slug = req.query.slug as string;
    if (!slug || typeof slug !== "string") {
      res.status(400).json({ error: "missing_slug", message: "Paramètre ?slug=<slug> manquant." });
      return;
    }
    const person = await storage.getPersonBySlug(slug);
    if (!person) {
      res.status(404).json({ error: "unknown_slug", message: UNKNOWN_SLUG_MESSAGE });
      return;
    }
    const active = await storage.ensureActiveProject(person.id);
    const archived = await storage.getArchivedProjects(person.id);
    const praxeologie = await storage.listPraxeologie(person.id);
    const coachingNotes = await storage.getCoachingNotes(person.id);
    res.json({
      person: { slug: person.slug, displayName: person.displayName },
      project: active.project,
      entries: active.entries,
      projectId: active.id,
      archivedProjects: archived.map((p) => ({
        id: p.id,
        project: p.project,
        entries: p.entries,
        archivedAt: p.archivedAt,
      })),
      praxeologie,
      coachingNotes,
    });
  })
);

// PUT /api/admin/coaching-notes — écrit (crée ou remplace) la note de Thierry pour UNE étape
// d'UNE personne. Écrire à nouveau remplace la note existante (voir upsertCoachingNote()).
app.put(
  "/api/admin/coaching-notes",
  requireAdmin,
  validate(CoachingNoteUpsertSchema),
  asyncRoute(async (req, res) => {
    const { slug, phaseKey, text } = (req as any).validated;
    const person = await storage.getPersonBySlug(slug);
    if (!person) {
      res.status(404).json({ error: "unknown_slug", message: UNKNOWN_SLUG_MESSAGE });
      return;
    }
    const note = await storage.upsertCoachingNote(person.id, phaseKey, text);
    res.json({ note });
  })
);

// 404 générique pour toute route /api/* non reconnue
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "not_found" });
});

export default app;
