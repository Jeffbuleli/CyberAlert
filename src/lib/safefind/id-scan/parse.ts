/**
 * Local ID payload parsing for SafeFind autofill.
 * Never sends raw scans to the network — caller confirms fields before submit.
 */

export type ParsedIdFields = {
  documentType: "carte_electeur" | "passeport" | "permis_conduire" | null;
  holderFirstName: string | null;
  holderLastName: string | null;
  documentNumber: string | null;
  source: "mrz" | "qr" | "barcode" | "manual";
  confidence: number;
  rawKind: string;
};

function cleanName(s: string): string {
  return s
    .replace(/</g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** ICAO TD3 passport MRZ (2×44). */
export function parseMrzTd3(text: string): ParsedIdFields | null {
  const lines = text
    .toUpperCase()
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, ""))
    .filter((l) => l.length >= 30);

  let l1: string | undefined;
  let l2: string | undefined;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith("P") && lines[i].length >= 44 && lines[i + 1].length >= 44) {
      l1 = lines[i].slice(0, 44);
      l2 = lines[i + 1].slice(0, 44);
      break;
    }
  }
  if (!l1 || !l2) {
    const compact = text.toUpperCase().replace(/[^A-Z0-9<]/g, "");
    const idx = compact.indexOf("P<");
    if (idx >= 0 && compact.length >= idx + 88) {
      l1 = compact.slice(idx, idx + 44);
      l2 = compact.slice(idx + 44, idx + 88);
    }
  }
  if (!l1 || !l2 || l1.length < 44 || l2.length < 44) return null;

  const names = l1.slice(5).split("<<");
  const last = cleanName(names[0] ?? "");
  const first = cleanName((names[1] ?? "").split("<")[0] ?? "");
  const docNum = l2.slice(0, 9).replace(/</g, "").trim();

  return {
    documentType: "passeport",
    holderFirstName: first || null,
    holderLastName: last || null,
    documentNumber: docNum || null,
    source: "mrz",
    confidence: 0.9,
    rawKind: "td3",
  };
}

function inferDocType(raw: string): ParsedIdFields["documentType"] {
  const t = raw.toLowerCase();
  if (/passport|passeport|td3|\bp</i.test(t)) return "passeport";
  if (/permis|driving|license|licence/i.test(t)) return "permis_conduire";
  if (/electeur|voter|carte.?id|national.?id/i.test(t)) return "carte_electeur";
  return null;
}

/** QR / barcode payload: JSON, key=value, or plain doc number. */
export function parseQrOrBarcodePayload(raw: string): ParsedIdFields | null {
  const text = raw.trim();
  if (!text) return null;

  // Sleeve token for partners — not an identity doc
  if (/^SF-(SLV|SLEEVE)-/i.test(text) || /^SLEEVE[_-]/i.test(text)) {
    return {
      documentType: null,
      holderFirstName: null,
      holderLastName: null,
      documentNumber: text,
      source: "qr",
      confidence: 0.95,
      rawKind: "sleeve",
    };
  }

  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const docType =
      inferDocType(String(j.documentType ?? j.type ?? j.doc_type ?? "")) ??
      inferDocType(text);
    const first = String(j.firstName ?? j.prenom ?? j.given_name ?? "").trim() || null;
    const last = String(j.lastName ?? j.nom ?? j.surname ?? "").trim() || null;
    const num =
      String(j.documentNumber ?? j.number ?? j.doc_number ?? j.id ?? "").trim() || null;
    if (first || last || num) {
      return {
        documentType: docType,
        holderFirstName: first,
        holderLastName: last,
        documentNumber: num,
        source: "qr",
        confidence: 0.85,
        rawKind: "json",
      };
    }
  } catch {
    // not JSON
  }

  const kv: Record<string, string> = {};
  for (const part of text.split(/[;&|\n]/)) {
    const m = part.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/);
    if (m) kv[m[1].toLowerCase()] = m[2].trim();
  }
  if (Object.keys(kv).length >= 2) {
    return {
      documentType: inferDocType(kv.type ?? kv.documenttype ?? text),
      holderFirstName: kv.firstname ?? kv.prenom ?? null,
      holderLastName: kv.lastname ?? kv.nom ?? null,
      documentNumber: kv.number ?? kv.documentnumber ?? kv.id ?? null,
      source: "qr",
      confidence: 0.75,
      rawKind: "kv",
    };
  }

  const mrz = parseMrzTd3(text);
  if (mrz) return mrz;

  // Plain alphanumeric document id
  if (/^[A-Z0-9][A-Z0-9\-\/]{4,31}$/i.test(text) && !/\s/.test(text)) {
    return {
      documentType: inferDocType(text),
      holderFirstName: null,
      holderLastName: null,
      documentNumber: text.toUpperCase(),
      source: "barcode",
      confidence: 0.55,
      rawKind: "plain",
    };
  }

  return null;
}

export function parseIdScanPayload(raw: string): ParsedIdFields | null {
  return parseMrzTd3(raw) ?? parseQrOrBarcodePayload(raw);
}

/** Strip fields that must never leave the device toward an LLM. */
export function redactParsedForAi(p: ParsedIdFields): Record<string, unknown> {
  return {
    documentType: p.documentType,
    holderFirstNameMasked: p.holderFirstName
      ? `${p.holderFirstName[0]}***`
      : null,
    holderLastNameMasked: p.holderLastName
      ? `${p.holderLastName[0]}***`
      : null,
    documentNumberLast4: p.documentNumber
      ? p.documentNumber.replace(/\s+/g, "").slice(-4)
      : null,
    source: p.source,
    confidence: p.confidence,
  };
}
