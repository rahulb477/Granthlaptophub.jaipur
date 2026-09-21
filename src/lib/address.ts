/**
 * Human-readable address formatter for the Admin Panel.
 *
 * Orders in Firestore store addresses in several shapes depending on when /
 * where they were created:
 *   1. structured object  { fullName, mobile, house, road, area, city, state, pincode, createdAt, id, ... }
 *   2. legacy object      { name, phone, address1, address2, landmark, zip, ... }
 *   3. plain string       "245, Sitaram Society Road, Jaipur"
 *
 * The Order Details modal previously rendered `JSON.stringify(address)`, which
 * exposed raw Firestore Timestamps and internal ids. This module converts any
 * of those shapes into clean display values and NEVER emits "undefined",
 * "null", "[object Object]" or raw JSON.
 */

export interface FormattedAddress {
  name: string;
  phone: string;
  /** Ordered, already-trimmed address lines. Empty array when nothing usable. */
  lines: string[];
  /** Single-line version, useful for tables. */
  oneLine: string;
  /** True when no usable address data exists at all. */
  empty: boolean;
}

/** Keys that must never be displayed — internal metadata, not address data. */
const HIDDEN_KEYS = new Set([
  "id",
  "uid",
  "userid",
  "docid",
  "addressid",
  "createdat",
  "updatedat",
  "timestamp",
  "isdefault",
  "default",
  "type",
  "label",
  "seconds",
  "nanoseconds",
  "_methodname",
]);

function clean(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return "";
  if (typeof v !== "string") return ""; // objects (Timestamps etc.) are never rendered
  const s = v.trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "undefined" || low === "null" || low === "nan" || low === "[object object]") return "";
  return s;
}

function pick(src: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const val = clean(src[k]);
    if (val) return val;
  }
  return "";
}

/** Formats any supported address shape into clean, displayable parts. */
export function formatAddress(
  raw: unknown,
  fallback?: { name?: string; phone?: string }
): FormattedAddress {
  const fallbackName = clean(fallback?.name);
  const fallbackPhone = clean(fallback?.phone);

  // --- plain string address ------------------------------------------------
  if (typeof raw === "string") {
    const line = clean(raw);
    return {
      name: fallbackName,
      phone: fallbackPhone,
      lines: line ? line.split(/\s*,\s*/).filter(Boolean) : [],
      oneLine: line,
      empty: !line,
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      name: fallbackName,
      phone: fallbackPhone,
      lines: [],
      oneLine: "",
      empty: true,
    };
  }

  const a = raw as Record<string, unknown>;

  const name =
    pick(a, ["fullName", "fullname", "name", "customerName", "receiverName", "contactName"]) ||
    fallbackName;
  const phone =
    pick(a, ["mobile", "phone", "phoneNumber", "contact", "contactNumber", "alternatePhone"]) ||
    fallbackPhone;

  const house = pick(a, ["house", "houseNo", "flat", "flatNo", "building", "addressLine1", "address1"]);
  const road = pick(a, ["road", "street", "streetAddress", "addressLine2", "address2", "lane"]);
  const area = pick(a, ["area", "locality", "colony", "sector", "landmark", "village"]);
  const city = pick(a, ["city", "town", "district"]);
  const state = pick(a, ["state", "province", "region"]);
  const pincode = pick(a, ["pincode", "pinCode", "pin", "zip", "zipcode", "zipCode", "postalCode"]);
  const country = pick(a, ["country"]);

  const known = [house, road, area, city, state, pincode, country];
  const knownLower = new Set(known.filter(Boolean).map((v) => v.toLowerCase()));

  // Any remaining string field that looks like address data (and isn't
  // internal metadata or already captured) is appended so nothing is lost.
  const extras: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    const key = k.toLowerCase();
    if (HIDDEN_KEYS.has(key)) continue;
    if (
      [
        "fullname", "name", "customername", "receivername", "contactname",
        "mobile", "phone", "phonenumber", "contact", "contactnumber", "alternatephone",
        "house", "houseno", "flat", "flatno", "building", "addressline1", "address1",
        "road", "street", "streetaddress", "addressline2", "address2", "lane",
        "area", "locality", "colony", "sector", "landmark", "village",
        "city", "town", "district", "state", "province", "region",
        "pincode", "pin", "zip", "zipcode", "postalcode", "country",
      ].includes(key)
    ) {
      continue;
    }
    const val = clean(v);
    if (!val) continue;
    if (knownLower.has(val.toLowerCase())) continue;
    extras.push(val);
  }

  // Compose readable lines: street block, then city / state / pin.
  const lineOne = [house, road].filter(Boolean).join(", ");
  const lineTwo = area;
  const cityState = [city, state].filter(Boolean).join(", ");
  const lines = [lineOne, lineTwo, cityState, pincode, country, ...extras].filter(Boolean);

  const oneLine = lines.join(", ");

  return {
    name,
    phone,
    lines,
    oneLine,
    empty: lines.length === 0,
  };
}

/** Labelled field list for a detailed address view (missing fields omitted). */
export function addressFieldList(raw: unknown): { label: string; value: string }[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    const one = formatAddress(raw);
    return one.oneLine ? [{ label: "Address", value: one.oneLine }] : [];
  }
  const a = raw as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, keys: string[]) => {
    const v = pick(a, keys);
    if (v) rows.push({ label, value: v });
  };
  push("Full Name", ["fullName", "fullname", "name", "customerName"]);
  push("Phone", ["mobile", "phone", "phoneNumber", "contact"]);
  push("House / Flat", ["house", "houseNo", "flat", "flatNo", "building", "addressLine1", "address1"]);
  push("Street / Road", ["road", "street", "streetAddress", "addressLine2", "address2"]);
  push("Area", ["area", "locality", "colony", "sector", "landmark"]);
  push("City", ["city", "town", "district"]);
  push("State", ["state", "province", "region"]);
  push("Pincode", ["pincode", "pinCode", "pin", "zip", "zipcode", "postalCode"]);
  return rows;
}
