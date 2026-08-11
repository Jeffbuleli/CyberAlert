/**
 * Geoapify Address Autocomplete + Geocoding.
 * Free tier: ~3000 credits/day (1 credit ≈ 1 autocomplete/geocode).
 * https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
 */
import type { LocationProvider } from "../provider";
import type { PlaceSuggestion, StructuredLocationInput } from "../types";

const KINSHASA_LON = 15.312;
const KINSHASA_LAT = -4.325;

function apiKey(): string {
  return process.env.GEOAPIFY_API_KEY?.trim() || "";
}

type GeoapifyResult = {
  place_id?: string | number;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  country?: string;
  state?: string;
  city?: string;
  county?: string;
  suburb?: string;
  district?: string;
  street?: string;
  lat?: number;
  lon?: number;
  result_type?: string;
  category?: string;
};

function precisionFromType(t?: string): StructuredLocationInput["precision"] {
  switch (t) {
    case "amenity":
    case "building":
      return "BUILDING";
    case "street":
      return "STREET";
    case "suburb":
    case "district":
      return "QUARTER";
    case "city":
    case "county":
      return "COMMUNE";
    default:
      return "LANDMARK";
  }
}

function toStructured(r: GeoapifyResult, rawQuery?: string): StructuredLocationInput {
  const commune =
    r.county ||
    r.suburb ||
    r.district ||
    (r.city && r.city !== "Kinshasa" ? r.city : undefined);
  return {
    country: r.country ?? "RDC",
    province: r.state ?? "Kinshasa",
    city: r.city ?? "Kinshasa",
    commune: commune ?? undefined,
    quartier: r.suburb || r.district || undefined,
    landmark: r.name || r.address_line1 || undefined,
    placeId: r.place_id != null ? String(r.place_id) : null,
    latitude: r.lat ?? null,
    longitude: r.lon ?? null,
    accuracyMeters: null,
    precision: precisionFromType(r.result_type),
    source: "geoapify",
    label: r.formatted ?? r.address_line1 ?? r.name ?? null,
    rawQuery: rawQuery ?? null,
  };
}

async function geoGet(
  path: string,
  params: Record<string, string>,
): Promise<{ results?: GeoapifyResult[] } | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`https://api.geoapify.com${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  url.searchParams.set("apiKey", key);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    console.warn("[safefind/geoapify] http", res.status, path);
    return null;
  }
  return (await res.json()) as { results?: GeoapifyResult[] };
}

export function createGeoapifyProvider(): LocationProvider {
  const configured = Boolean(apiKey());
  return {
    id: "geoapify",
    configured,
    async autocomplete(args) {
      const text = args.input.trim();
      if (!configured || text.length < 3) return [];
      const json = await geoGet("/v1/geocode/autocomplete", {
        text,
        lang: args.language ?? "fr",
        filter: "countrycode:cd",
        bias: `proximity:${KINSHASA_LON},${KINSHASA_LAT}`,
        format: "json",
        limit: "8",
      });
      const out: PlaceSuggestion[] = [];
      for (const r of json?.results ?? []) {
        const placeId =
          r.place_id != null
            ? String(r.place_id)
            : `geoapify:q:${r.formatted ?? r.name ?? text}`;
        out.push({
          placeId,
          primaryText: r.name || r.address_line1 || r.formatted || text,
          secondaryText:
            r.address_line2 ||
            [r.suburb, r.city, r.country].filter(Boolean).join(", ") ||
            "RDC",
          fullText: r.formatted ?? r.name ?? text,
          latitude: r.lat ?? null,
          longitude: r.lon ?? null,
          provider: "geoapify",
        });
      }
      return out;
    },
    async resolvePlaceId(placeId) {
      if (!configured || !placeId) return null;
      if (placeId.startsWith("geoapify:q:")) {
        return this.geocode(placeId.replace("geoapify:q:", ""));
      }
      // Place Details when available; fallback to geocode by id as text filter
      const detailsUrl = new URL("https://api.geoapify.com/v2/place-details");
      detailsUrl.searchParams.set("id", placeId);
      detailsUrl.searchParams.set("apiKey", apiKey());
      const res = await fetch(detailsUrl.toString(), { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          features?: Array<{
            properties?: GeoapifyResult & { lat?: number; lon?: number };
            geometry?: { coordinates?: [number, number] };
          }>;
          properties?: GeoapifyResult;
        };
        const props =
          json.features?.[0]?.properties ??
          json.properties ??
          null;
        const coords = json.features?.[0]?.geometry?.coordinates;
        if (props) {
          if (props.lat == null && coords) {
            props.lon = coords[0];
            props.lat = coords[1];
          }
          return toStructured(props);
        }
      }
      // Autocomplete/search fallback with place id as query is weak; return null
      return null;
    },
    async geocode(address) {
      const text = address.trim();
      if (!configured || !text) return null;
      const json = await geoGet("/v1/geocode/search", {
        text: text.includes("Kinshasa") ? text : `${text}, Kinshasa`,
        lang: "fr",
        filter: "countrycode:cd",
        bias: `proximity:${KINSHASA_LON},${KINSHASA_LAT}`,
        format: "json",
        limit: "1",
      });
      const r = json?.results?.[0];
      if (!r) return null;
      return toStructured(r, text);
    },
  };
}
