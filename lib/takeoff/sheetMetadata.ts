export type PositionedPdfText = {
  text: string;
  x: number;
  y: number;
  pageWidth: number;
  pageHeight: number;
};

export type SheetMetadata = {
  sheetNumber: string | null;
  title: string | null;
  confidence: number;
};

export type StoredSheetMetadata = {
  sheet_number?: string | null;
  title?: string | null;
};

const titleWords = /\b(PLAN|PLANS|FOUNDATION|FRAMING|FLOOR|ROOF|SITE|CIVIL|STRUCTURAL|DETAIL|DETAILS|SECTION|SECTIONS|ELEVATION|ELEVATIONS|NOTES|SCHEDULE|SCHEDULES|GENERAL|DEMOLITION|GRADING|UTILITY|UTILITIES|REFLECTED|CEILING|SLAB|WALL)\b/i;
const noiseWords = /\b(PROJECT|PROJECT NO|ADDRESS|OWNER|ARCHITECT|ENGINEER|DRAWN|CHECKED|DATE|SCALE|REVISION|REVISIONS|ISSUE|SHEET OF|COPYRIGHT)\b/i;
const numberPattern = /\b([A-Z]{1,3})\s*[- ]?\s*(\d{1,3}(?:\.\d{1,2})?)\b/i;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeSheetNumber = (prefix: string, number: string) => `${prefix.toUpperCase()}${number}`;

const locationScore = (item: PositionedPdfText) => {
  const nx = item.pageWidth > 0 ? item.x / item.pageWidth : 0;
  const ny = item.pageHeight > 0 ? item.y / item.pageHeight : 1;
  let score = 0;
  if (nx >= 0.72) score += 4;
  else if (nx >= 0.55) score += 2;
  if (ny <= 0.28) score += 4;
  else if (ny <= 0.45) score += 2;
  return score;
};

const titleScore = (text: string) => {
  const value = normalizeText(text);
  if (value.length < 4 || value.length > 72) return -10;
  if (noiseWords.test(value)) return -8;
  if (/^\d+(?:\.\d+)*$/.test(value)) return -8;
  if (/^\d+[/'-]\d+/.test(value)) return -8;
  let score = 0;
  if (titleWords.test(value)) score += 6;
  if (/^[A-Z0-9 &/.'()-]+$/.test(value)) score += 1;
  const words = value.split(' ').filter(Boolean).length;
  if (words >= 2 && words <= 7) score += 2;
  return score;
};

const inlineTitle = (text: string, match: RegExpMatchArray) => {
  const start = (match.index || 0) + match[0].length;
  const remainder = normalizeText(text.slice(start).replace(/^[\s:|—–-]+/, ''));
  return titleScore(remainder) >= 6 ? remainder : null;
};

export function inferSheetMetadata(items: PositionedPdfText[]): SheetMetadata {
  const clean = items
    .map(item => ({ ...item, text: normalizeText(item.text) }))
    .filter(item => item.text);

  let bestNumber: { value: string; item: PositionedPdfText; score: number; inlineTitle: string | null } | null = null;
  for (const item of clean) {
    const match = item.text.match(numberPattern);
    if (!match) continue;
    const value = normalizeSheetNumber(match[1], match[2]);
    let score = locationScore(item);
    const compactSource = item.text.replace(/[\s-]+/g, '').toUpperCase();
    if (compactSource === value) score += 3;
    if (/^[A-Z]{1,3}\d/.test(value)) score += 1;
    const candidateInlineTitle = inlineTitle(item.text, match);
    if (candidateInlineTitle) score += 2;
    if (!bestNumber || score > bestNumber.score) {
      bestNumber = { value, item, score, inlineTitle: candidateInlineTitle };
    }
  }

  if (!bestNumber || bestNumber.score < 4) return { sheetNumber: null, title: null, confidence: 0 };

  let bestTitle: { value: string; score: number } | null = bestNumber.inlineTitle
    ? { value: bestNumber.inlineTitle, score: titleScore(bestNumber.inlineTitle) + locationScore(bestNumber.item) + 4 }
    : null;

  for (const item of clean) {
    if (item === bestNumber.item) continue;
    const base = titleScore(item.text);
    if (base < 0) continue;
    const dx = Math.abs(item.x - bestNumber.item.x) / Math.max(1, item.pageWidth);
    const dy = Math.abs(item.y - bestNumber.item.y) / Math.max(1, item.pageHeight);
    let score = base + locationScore(item);
    if (dx <= 0.24) score += 3;
    if (dy <= 0.16) score += 4;
    else if (dy <= 0.28) score += 2;
    if (!bestTitle || score > bestTitle.score) bestTitle = { value: item.text, score };
  }

  const title = bestTitle && bestTitle.score >= 8 ? bestTitle.value : null;
  const confidence = Math.min(1, (bestNumber.score + (bestTitle?.score || 0)) / 24);
  return { sheetNumber: bestNumber.value, title, confidence };
}

export function mergeSheetMetadata(existing: StoredSheetMetadata | null | undefined, inferred: SheetMetadata) {
  const existingNumber = normalizeText(String(existing?.sheet_number || '')) || null;
  const existingTitle = normalizeText(String(existing?.title || '')) || null;
  return {
    sheet_number: existingNumber || inferred.sheetNumber,
    title: existingTitle || inferred.title,
  };
}

export function sheetDisplayLabel(sheet: { page_number?: number | null; sheet_number?: string | null; title?: string | null }) {
  const number = normalizeText(String(sheet.sheet_number || ''));
  const title = normalizeText(String(sheet.title || ''));
  if (number && title) return `${number} — ${title}`;
  if (number) return number;
  if (title) return title;
  return `PDF Page ${Number(sheet.page_number || 0) || ''}`.trim();
}
