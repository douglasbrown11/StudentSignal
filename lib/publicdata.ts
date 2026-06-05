// Best-effort public-data enrichment via NYC 311 Service Requests (Socrata open
// API, no key required). We query recent complaints whose type matches the issue
// category. This is real public data; it is citywide pattern data, not necessarily
// tied to this exact building, and the AI layer is told to treat it honestly.
// The call is timeboxed and never throws — if it fails or returns nothing, the
// workflow continues with an empty record set.

const SOCRATA_311 = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

// Map our asset category to NYC 311 complaint_type keywords (SoQL LIKE, uppercased).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fire_and_life_safety: ["FIRE SAFETY", "EMERGENCY LIGHT", "EXIT", "BUILDING"],
  electrical: ["ELECTRIC"],
  plumbing: ["PLUMB", "WATER", "SEWER"],
  hvac: ["HEAT", "AIR QUALITY"],
  structural: ["STRUCTUR", "CONSTRUCTION"],
  security: ["DOOR", "LOCK"],
  general: [],
};

export interface PublicRecord {
  complaintType: string;
  descriptor: string | null;
  address: string | null;
  borough: string | null;
  status: string | null;
  date: string | null;
}

export interface PublicDataResult {
  source: string;
  query: string | null;
  records: PublicRecord[];
  note: string | null;
}

export async function fetchPublicData(category: string): Promise<PublicDataResult> {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  const base: PublicDataResult = {
    source: "NYC 311 Service Requests (NYC Open Data)",
    query: null,
    records: [],
    note: null,
  };

  if (keywords.length === 0) {
    base.note = "No public-data query mapped for this category; relying on domain knowledge.";
    return base;
  }

  const whereClause = keywords.map((k) => `upper(complaint_type) like '%${k}%'`).join(" OR ");
  const params = new URLSearchParams({
    $select: "complaint_type,descriptor,incident_address,borough,status,created_date",
    $where: whereClause,
    $order: "created_date DESC",
    $limit: "6",
  });
  const url = `${SOCRATA_311}?${params.toString()}`;
  base.query = `complaint_type ~ ${keywords.join("/")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      base.note = `NYC 311 returned HTTP ${res.status}; proceeding without live records.`;
      return base;
    }
    const rows: any[] = await res.json();
    base.records = (rows ?? []).map((r) => ({
      complaintType: r.complaint_type ?? "(unknown)",
      descriptor: r.descriptor ?? null,
      address: r.incident_address ?? null,
      borough: r.borough ?? null,
      status: r.status ?? null,
      date: r.created_date ?? null,
    }));
    if (base.records.length === 0) {
      base.note = "No recent matching NYC 311 complaints found.";
    }
    return base;
  } catch (err) {
    base.note = `NYC 311 lookup unavailable (${(err as Error).name}); proceeding without live records.`;
    return base;
  } finally {
    clearTimeout(timeout);
  }
}
