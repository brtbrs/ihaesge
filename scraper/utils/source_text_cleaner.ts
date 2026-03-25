const CNBC_TRAILING_PATTERNS: RegExp[] = [
  /^\([a-z]{2,}\/([a-z]{2,})\)$/i,
  /^Add as a preferred source on Google$/i,
  /^\[Gambas:Video CNBC\]$/i,
  /^Next Article$/i,
];

const CNBC_LEADING_PATTERNS: RegExp[] = [
  /^CNBC Indonesia$/i,
  /^Baca\s*:/i,
  /^[A-Za-zÀ-ÿ'.\-\s]{2,60}\/[A-Za-zÀ-ÿ'.\-\s]{2,60}$/,
  /^([A-Z][A-Za-zÀ-ÿ'.\-]*\s){1,4}[A-Z][A-Za-zÀ-ÿ'.\-]*$/,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{4}\b/,
  /\bWIB\b/i,
];

export function cleanCnbcText(content: string, title?: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "";
  }

  const filteredMiddle = lines.filter((line) => {
    if (/^Baca\s*:/i.test(line)) {
      return false;
    }
    return true;
  });

  let start = 0;
  while (start < filteredMiddle.length && start < 8) {
    const line = filteredMiddle[start];
    const normalizedTitle = title?.trim().toLowerCase();
    const normalizedLine = line.toLowerCase();

    if (normalizedTitle && normalizedLine === normalizedTitle) {
      start += 1;
      continue;
    }

    const isLeadingMeta = CNBC_LEADING_PATTERNS.some((pattern) => pattern.test(line));
    if (isLeadingMeta) {
      start += 1;
      continue;
    }

    break;
  }

  let end = filteredMiddle.length;
  while (end > start) {
    const line = filteredMiddle[end - 1];
    const shouldTrim = CNBC_TRAILING_PATTERNS.some((pattern) => pattern.test(line));
    if (!shouldTrim) {
      break;
    }
    end -= 1;
  }

  return filteredMiddle.slice(start, end).join("\n");
}
