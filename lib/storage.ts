// Couche de persistance — Supabase Postgres, requêtes directes (pas d'ORM),
// conversion manuelle camelCase (JS) <-> snake_case (colonnes SQL), comme dans
// le premier backend (voir la note d'architecture reprise dans le cahier des charges).
import { getSupabase } from "./supabase";
import { blankEntries, COACHING_PHASE_KEYS, EntriesT, PHASE_KEYS } from "./types";

export interface Person {
  id: string;
  slug: string;
  displayName: string;
  createdAt: string;
}

export interface ProjectMeta {
  poieticTitle: string;
  workingTitle: string;
  genre: string;
  started: string;
  authorName: string;
  place: string;
  stageStatus: Record<string, string> | null;
  phaseTextOverrides: Record<string, string[]> | null;
}

export interface ProjectRow {
  id: string;
  personId: string;
  status: "active" | "archived";
  project: ProjectMeta;
  entries: EntriesT;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PraxRow {
  id: string;
  personId: string;
  d: string | null;
  stage: string | null;
  type: "probleme" | "decouverte" | "apprentissage";
  status: "ouvert" | "resolu" | null;
  text: string;
  createdAt: string;
}

export interface PersonWithStats extends Person {
  link: string;
  currentStage: string;
  totalSessions: number;
  lastActivity: string | null;
}

function defaultStageStatus(): Record<string, string> {
  const st: Record<string, string> = {};
  PHASE_KEYS.forEach((k, i) => {
    st[k] = i === 0 ? "current" : "upcoming";
  });
  st["naissance"] = "upcoming";
  return st;
}

function nowLabelFR(): string {
  const MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const d = new Date();
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function rowToProject(row: any): ProjectRow {
  return {
    id: row.id,
    personId: row.person_id,
    status: row.status,
    project: {
      poieticTitle: row.poietic_title || "",
      workingTitle: row.working_title || "",
      genre: row.genre || "",
      started: row.started || "",
      authorName: row.author_name || "",
      place: row.place || "",
      stageStatus: row.stage_status || null,
      phaseTextOverrides: row.phase_text_overrides || null,
    },
    entries: row.entries,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export interface IStorage {
  getPersonBySlug(slug: string): Promise<Person | null>;
  createPerson(displayName: string, slug: string): Promise<Person>;
  listPersonsWithStats(): Promise<PersonWithStats[]>;

  getActiveProject(personId: string): Promise<ProjectRow | null>;
  getArchivedProjects(personId: string): Promise<ProjectRow[]>;
  ensureActiveProject(personId: string): Promise<ProjectRow>;
  updateActiveProject(
    personId: string,
    meta: Omit<ProjectMeta, "stageStatus" | "phaseTextOverrides"> & {
      stageStatus?: Record<string, string> | null;
      phaseTextOverrides?: Record<string, string[]> | null;
    },
    entries: EntriesT
  ): Promise<ProjectRow>;
  archiveActiveAndCreateNew(personId: string): Promise<{ archived: ProjectRow | null; active: ProjectRow }>;
  restoreProject(personId: string, projectId: string): Promise<{ restored: ProjectRow; archivedPrevious: ProjectRow | null }>;
  // Suppression définitive d'un projet archivé — pas demandée explicitement dans le cahier
  // des charges (qui ne liste que GET/PUT/archive/restore), ajoutée pour garder le même
  // comportement que le bouton « Supprimer » du portfolio dans l'artefact Base. Voir la
  // note « choix de jugement » du résumé final.
  deleteArchivedProject(personId: string, projectId: string): Promise<boolean>;

  listPraxeologie(personId: string): Promise<PraxRow[]>;
  createPraxeologie(
    personId: string,
    data: { d?: string; stage?: string | null; type: PraxRow["type"]; text: string }
  ): Promise<PraxRow>;
  patchPraxeologieStatus(personId: string, id: string, status: "ouvert" | "resolu"): Promise<PraxRow | null>;
  countSessionsForPerson(personId: string): Promise<number>;

  // Notes de coaching (une par étape par personne, voir sql/schema.sql) — un outil
  // d'accompagnement pour Thierry, lu aussi par la personne elle-même dans sa propre app
  // (voir GET /api/project, qui inclut désormais coachingNotes).
  getCoachingNotes(personId: string): Promise<Record<string, string>>;
  upsertCoachingNote(personId: string, phaseKey: string, text: string): Promise<{ phaseKey: string; text: string; updatedAt: string }>;
}

export class SupabaseStorage implements IStorage {
  private sb() {
    return getSupabase();
  }

  async getPersonBySlug(slug: string): Promise<Person | null> {
    const { data, error } = await this.sb().from("persons").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, slug: data.slug, displayName: data.display_name, createdAt: data.created_at };
  }

  async createPerson(displayName: string, slug: string): Promise<Person> {
    const { data, error } = await this.sb()
      .from("persons")
      .insert({ display_name: displayName, slug })
      .select("*")
      .single();
    if (error) throw error;
    // Chaque nouvelle personne démarre avec un projet actif vierge.
    await this.ensureActiveProject(data.id);
    return { id: data.id, slug: data.slug, displayName: data.display_name, createdAt: data.created_at };
  }

  async listPersonsWithStats(): Promise<PersonWithStats[]> {
    const { data: persons, error } = await this.sb().from("persons").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const out: PersonWithStats[] = [];
    for (const p of persons || []) {
      const { data: projects, error: pErr } = await this.sb()
        .from("projects")
        .select("*")
        .eq("person_id", p.id);
      if (pErr) throw pErr;
      const rows: ProjectRow[] = (projects || []).map(rowToProject);
      const active: ProjectRow | null = rows.find((r) => r.status === "active") || null;
      const totalSessions: number = rows.reduce((n: number, r) => n + countSessionsInEntries(r.entries), 0);
      const lastActivity: string | null = rows.reduce<string | null>((latest, r) => {
        if (!latest) return r.updatedAt;
        return new Date(r.updatedAt) > new Date(latest) ? r.updatedAt : latest;
      }, null);
      const stageStatus = active?.project.stageStatus || defaultStageStatus();
      const currentKey = Object.keys(stageStatus).find((k) => stageStatus[k] === "current") || "inception";
      out.push({
        id: p.id,
        slug: p.slug,
        displayName: p.display_name,
        createdAt: p.created_at,
        link: `/?p=${p.slug}`,
        currentStage: currentKey,
        totalSessions,
        lastActivity,
      });
    }
    return out;
  }

  async getActiveProject(personId: string): Promise<ProjectRow | null> {
    const { data, error } = await this.sb()
      .from("projects")
      .select("*")
      .eq("person_id", personId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data ? rowToProject(data) : null;
  }

  async getArchivedProjects(personId: string): Promise<ProjectRow[]> {
    const { data, error } = await this.sb()
      .from("projects")
      .select("*")
      .eq("person_id", personId)
      .eq("status", "archived")
      .order("archived_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToProject);
  }

  async ensureActiveProject(personId: string): Promise<ProjectRow> {
    const existing = await this.getActiveProject(personId);
    if (existing) return existing;
    const { data, error } = await this.sb()
      .from("projects")
      .insert({
        person_id: personId,
        status: "active",
        poietic_title: "Mon projet créateur",
        working_title: "",
        genre: "",
        started: "",
        author_name: "",
        place: "",
        entries: blankEntries(),
        stage_status: defaultStageStatus(),
        phase_text_overrides: {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToProject(data);
  }

  async updateActiveProject(
    personId: string,
    meta: Omit<ProjectMeta, "stageStatus" | "phaseTextOverrides"> & {
      stageStatus?: Record<string, string> | null;
      phaseTextOverrides?: Record<string, string[]> | null;
    },
    entries: EntriesT
  ): Promise<ProjectRow> {
    const active = await this.ensureActiveProject(personId);
    const { data, error } = await this.sb()
      .from("projects")
      .update({
        poietic_title: meta.poieticTitle,
        working_title: meta.workingTitle,
        genre: meta.genre,
        started: meta.started,
        author_name: meta.authorName,
        place: meta.place,
        stage_status: meta.stageStatus ?? active.project.stageStatus ?? defaultStageStatus(),
        phase_text_overrides: meta.phaseTextOverrides ?? active.project.phaseTextOverrides ?? {},
        entries,
        updated_at: new Date().toISOString(),
      })
      .eq("id", active.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToProject(data);
  }

  async archiveActiveAndCreateNew(personId: string): Promise<{ archived: ProjectRow | null; active: ProjectRow }> {
    const current = await this.getActiveProject(personId);
    let archived: ProjectRow | null = null;
    if (current) {
      const hasContent =
        countSessionsInEntries(current.entries) > 0 ||
        (current.entries.experienceGlobale?.journal?.length || 0) > 0 ||
        PHASE_KEYS.some((k) => !!(current.entries as any)[k]?.compilation?.text?.trim());
      if (hasContent) {
        const { data, error } = await this.sb()
          .from("projects")
          .update({ status: "archived", archived_at: new Date().toISOString() })
          .eq("id", current.id)
          .select("*")
          .single();
        if (error) throw error;
        archived = rowToProject(data);
      } else {
        // Rien dedans : on réutilise la ligne actuelle, la remettant simplement à blanc,
        // plutôt que d'accumuler des lignes « active » vides archivées.
        const { data, error } = await this.sb()
          .from("projects")
          .update({
            poietic_title: "Mon projet créateur",
            working_title: "",
            genre: "",
            started: "",
            author_name: "",
            place: "",
            entries: blankEntries(),
            stage_status: defaultStageStatus(),
            phase_text_overrides: {},
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id)
          .select("*")
          .single();
        if (error) throw error;
        return { archived: null, active: rowToProject(data) };
      }
    }
    const { data: newActiveRow, error: insErr } = await this.sb()
      .from("projects")
      .insert({
        person_id: personId,
        status: "active",
        poietic_title: "Mon projet créateur",
        working_title: "",
        genre: "",
        started: "",
        author_name: "",
        place: "",
        entries: blankEntries(),
        stage_status: defaultStageStatus(),
        phase_text_overrides: {},
      })
      .select("*")
      .single();
    if (insErr) throw insErr;
    return { archived, active: rowToProject(newActiveRow) };
  }

  async restoreProject(personId: string, projectId: string): Promise<{ restored: ProjectRow; archivedPrevious: ProjectRow | null }> {
    const { data: targetRow, error: tErr } = await this.sb()
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("person_id", personId)
      .eq("status", "archived")
      .maybeSingle();
    if (tErr) throw tErr;
    if (!targetRow) throw new Error("Projet archivé introuvable pour cette personne.");

    const current = await this.getActiveProject(personId);
    let archivedPrevious: ProjectRow | null = null;
    if (current) {
      const hasContent =
        countSessionsInEntries(current.entries) > 0 ||
        (current.entries.experienceGlobale?.journal?.length || 0) > 0 ||
        PHASE_KEYS.some((k) => !!(current.entries as any)[k]?.compilation?.text?.trim());
      if (hasContent) {
        const { data, error } = await this.sb()
          .from("projects")
          .update({ status: "archived", archived_at: new Date().toISOString() })
          .eq("id", current.id)
          .select("*")
          .single();
        if (error) throw error;
        archivedPrevious = rowToProject(data);
      } else {
        // Projet actif courant vide : on le supprime plutôt que de l'archiver pour rien.
        await this.sb().from("projects").delete().eq("id", current.id);
      }
    }
    const { data: restoredRow, error: rErr } = await this.sb()
      .from("projects")
      .update({ status: "active", archived_at: null, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("*")
      .single();
    if (rErr) throw rErr;
    return { restored: rowToProject(restoredRow), archivedPrevious };
  }

  async deleteArchivedProject(personId: string, projectId: string): Promise<boolean> {
    const { data, error } = await this.sb()
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("person_id", personId)
      .eq("status", "archived")
      .select("id");
    if (error) throw error;
    return !!(data && data.length);
  }

  async listPraxeologie(personId: string): Promise<PraxRow[]> {
    const { data, error } = await this.sb()
      .from("praxeologie_entries")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      personId: r.person_id,
      d: r.d,
      stage: r.stage,
      type: r.type,
      status: r.status,
      text: r.text,
      createdAt: r.created_at,
    }));
  }

  async createPraxeologie(
    personId: string,
    data: { d?: string; stage?: string | null; type: PraxRow["type"]; text: string }
  ): Promise<PraxRow> {
    const { data: row, error } = await this.sb()
      .from("praxeologie_entries")
      .insert({
        person_id: personId,
        d: data.d || nowLabelFR(),
        stage: data.stage || null,
        type: data.type,
        status: data.type === "probleme" ? "ouvert" : null,
        text: data.text,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: row.id,
      personId: row.person_id,
      d: row.d,
      stage: row.stage,
      type: row.type,
      status: row.status,
      text: row.text,
      createdAt: row.created_at,
    };
  }

  async patchPraxeologieStatus(personId: string, id: string, status: "ouvert" | "resolu"): Promise<PraxRow | null> {
    const { data, error } = await this.sb()
      .from("praxeologie_entries")
      .update({ status })
      .eq("id", id)
      .eq("person_id", personId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      personId: data.person_id,
      d: data.d,
      stage: data.stage,
      type: data.type,
      status: data.status,
      text: data.text,
      createdAt: data.created_at,
    };
  }

  async countSessionsForPerson(personId: string): Promise<number> {
    const { data, error } = await this.sb().from("projects").select("entries").eq("person_id", personId);
    if (error) throw error;
    return (data || []).reduce((n: number, r: any) => n + countSessionsInEntries(r.entries), 0);
  }

  async getCoachingNotes(personId: string): Promise<Record<string, string>> {
    const { data, error } = await this.sb()
      .from("coaching_notes")
      .select("phase_key, text")
      .eq("person_id", personId);
    if (error) throw error;
    // Toutes les six clés apparaissent toujours dans le résultat (texte vide pour celles
    // sans note enregistrée) — plus simple à consommer côté client que l'absence de clé.
    const out: Record<string, string> = {};
    COACHING_PHASE_KEYS.forEach((k) => {
      out[k] = "";
    });
    (data || []).forEach((r: any) => {
      out[r.phase_key] = r.text || "";
    });
    return out;
  }

  async upsertCoachingNote(personId: string, phaseKey: string, text: string): Promise<{ phaseKey: string; text: string; updatedAt: string }> {
    // Même logique « select, puis insert si absent » qu'ensureActiveProject() ci-dessus —
    // pas de .upsert() ici, pour rester cohérent avec le reste de ce fichier.
    const { data: existing, error: selErr } = await this.sb()
      .from("coaching_notes")
      .select("id")
      .eq("person_id", personId)
      .eq("phase_key", phaseKey)
      .maybeSingle();
    if (selErr) throw selErr;
    const now = new Date().toISOString();
    if (existing) {
      const { data, error } = await this.sb()
        .from("coaching_notes")
        .update({ text, updated_at: now })
        .eq("id", existing.id)
        .select("phase_key, text, updated_at")
        .single();
      if (error) throw error;
      return { phaseKey: data.phase_key, text: data.text, updatedAt: data.updated_at };
    }
    const { data, error } = await this.sb()
      .from("coaching_notes")
      .insert({ person_id: personId, phase_key: phaseKey, text, updated_at: now })
      .select("phase_key, text, updated_at")
      .single();
    if (error) throw error;
    return { phaseKey: data.phase_key, text: data.text, updatedAt: data.updated_at };
  }
}

function countSessionsInEntries(entries: any): number {
  if (!entries) return 0;
  let n = 0;
  for (const k of PHASE_KEYS) {
    n += (entries[k]?.sessions || []).length;
  }
  return n;
}

export const storage: IStorage = new SupabaseStorage();
