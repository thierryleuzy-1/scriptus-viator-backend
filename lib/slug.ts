// Génération d'un slug lisible à partir du nom affiché, avec suffixe en cas de
// collision — ex. « marie-tremblay », puis « marie-tremblay-2 » si déjà pris.
import { getSupabase } from "./supabase";

export function slugify(input: string): string {
  return (
    String(input || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // retire les accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "personne"
  );
}

export async function generateUniqueSlug(displayName: string): Promise<string> {
  const base = slugify(displayName);
  const sb = getSupabase();
  let candidate = base;
  let suffix = 2;
  // Boucle bornée — une collision illimitée est extrêmement improbable, mais on
  // évite toute boucle infinie en cas de bug.
  for (let i = 0; i < 200; i++) {
    const { data, error } = await sb.from("persons").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  throw new Error("Impossible de générer un slug unique après 200 tentatives.");
}
