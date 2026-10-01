/** Assistant local : analyse déterministe, 100 % hors-ligne, aucun envoi serveur. */

const FR_STOP = new Set(
  "au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l m n s t y été être avoir faire comme tout tous toute toutes peut plus moins très aussi ainsi donc alors entre vers chez pendant depuis jusque dont où quand comment pourquoi parce pourquoi".split(" ")
);

export function tokenizeFr(text: string): string[] {
  return text.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç0-9]+/i).filter((w) => w.length > 2 && !FR_STOP.has(w));
}

export interface NoteStats { words: number; chars: number; minutes: number; sentences: number }

export function noteStats(text: string): NoteStats {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?…]+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3).length;
  return { words, chars: text.length, minutes: Math.max(1, Math.ceil(words / 200)), sentences };
}

/** Résumé extractif : phrases les mieux connectées au vocabulaire dominant. */
export function summarize(text: string, maxSentences = 4): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 4);
  if (sentences.length <= maxSentences) return sentences;
  const freq = new Map<string, number>();
  for (const t of tokenizeFr(text)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const scored = sentences.map((s, i) => {
    const toks = tokenizeFr(s);
    if (toks.length === 0) return { s, i, score: -1 };
    const score = toks.reduce((n, t) => n + (freq.get(t) ?? 0), 0) / Math.sqrt(toks.length);
    return { s, i, score };
  });
  return scored.filter((x) => x.score >= 0).sort((a, b) => b.score - a.score)
    .slice(0, maxSentences).sort((a, b) => a.i - b.i).map((x) => x.s);
}

export interface ActionItem { text: string; dueHint?: string }

const DATE_RE = /(\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?|avant le [^,.\n]+|d'ici (le )?[^,.\n]+|pour le [^,.\n]+|cette semaine|la semaine prochaine|demain|deadline|échéance|rappel)/i;

/** Actions détectées : cases à cocher, TODO, lignes datées. */
export function extractActions(blocks: { text: string; unchecked: boolean }[]): ActionItem[] {
  const out: ActionItem[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    const lines = b.text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const clean = line.replace(/^[☐☒•\-*]+\s*/, "").trim();
      if (!clean) continue;
      const m = clean.match(DATE_RE);
      const tagged = /^(todo|à faire|a faire|action)\b/i.test(clean);
      if (b.unchecked || tagged || m) {
        const text = clean.replace(/^(todo|à faire|a faire|action)\s*[:\-]?\s*/i, "");
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text, dueHint: m?.[0] });
        if (out.length >= 20) return out;
      }
    }
  }
  return out;
}

export interface RelatedNote { id: string; title: string; shared: number }

/** Notes liées : recouvrement de vocabulaire significatif. */
export function relatedNotes(currentId: string, currentText: string, notes: { id: string; title: string; text: string }[]): RelatedNote[] {
  const base = new Set(tokenizeFr(currentText));
  if (base.size < 3) return [];
  return notes
    .filter((n) => n.id !== currentId && n.text.trim().length > 20)
    .map((n) => {
      const toks = new Set(tokenizeFr(n.text + " " + n.title));
      let shared = 0;
      for (const t of toks) if (base.has(t)) shared += 1;
      return { id: n.id, title: n.title, shared };
    })
    .filter((r) => r.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3);
}

/** Titre proposé : première ligne substantielle, 8 mots max. */
export function suggestTitle(text: string): string {
  const line = text.split("\n").map((l) => l.replace(/^[#☐☒•\-*\s>]+/, "").trim()).find((l) => l.length >= 3);
  if (!line) return "";
  return line.split(/\s+/).slice(0, 8).join(" ").slice(0, 80);
}
