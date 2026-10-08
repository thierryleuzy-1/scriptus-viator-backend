// Appel direct à l'API Anthropic (Messages API), côté serveur uniquement —
// la clé ANTHROPIC_API_KEY n'est jamais envoyée au client. Remplace, côté
// backend, ce que window.claude.use("sample") / sample.json(...) faisaient
// dans l'artefact (capacité propre au runtime des artefacts Claude, absente
// ici puisque cette app tourne hors de claude.ai).
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 1600;

export class AnthropicError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface ImageInput {
  mediaType: string;
  dataBase64: string;
}

async function callAnthropic(
  prompt: string,
  opts: { maxTokens?: number; image?: ImageInput } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("missing_api_key", "ANTHROPIC_API_KEY n'est pas configurée sur le serveur.");
  }

  const contentBlocks: any[] = [];
  if (opts.image) {
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.dataBase64 },
    });
  }
  contentBlocks.push({ type: "text", text: prompt });

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
      messages: [{ role: "user", content: contentBlocks }],
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    if (res.status === 429) throw new AnthropicError("rate_limited", "Trop de demandes pour l'instant — réessaie dans un moment.");
    if (res.status >= 500) throw new AnthropicError("upstream_error", "Un problème technique est survenu chez Anthropic — réessaie.");
    throw new AnthropicError("upstream_error", `Anthropic a refusé la requête (${res.status}) : ${bodyText.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text = (data?.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
  if (!text) throw new AnthropicError("empty_completion", "Aucun texte produit — réessaie, ou avec moins de matériau.");
  return text;
}

// Équivalent de sample(prompt, opts) -> texte brut.
export async function callClaudeText(prompt: string, opts: { maxTokens?: number } = {}): Promise<string> {
  return callAnthropic(prompt, opts);
}

// Équivalent de sample.json(prompt, opts) -> objet JS parsé. Tolère un bloc de
// code (```json ... ```) autour du JSON, comme le ferait un modèle bavard.
export async function callClaudeJSON(prompt: string, opts: { maxTokens?: number; image?: ImageInput } = {}): Promise<any> {
  const text = await callAnthropic(prompt, opts);
  let jsonText = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(jsonText);
  if (fenced) jsonText = fenced[1];
  try {
    return JSON.parse(jsonText);
  } catch {
    const err = new AnthropicError("invalid_json", "La réponse n'était pas exploitable telle quelle — réessaie.");
    (err as any).rawText = text;
    throw err;
  }
}
