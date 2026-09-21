/**
 * Product hardware specifications + configurable RAM / Storage / Warranty
 * price options.
 *
 * Canonical Firestore field names written by the Admin Panel:
 *   processor, generation, screenSize, ram, storage, graphics, touch,
 *   operatingSystem, ramOptions[], storageOptions[], warrantyOptions[]
 *
 * Legacy field names still present on older documents are READ as fallbacks
 * and mirrored on write so the customer website keeps working during the
 * transition (nothing is deleted, nothing is renamed destructively):
 *   os            <-> operatingSystem
 *   screen/display<-> screenSize
 *   gen           <-> generation
 *   gpu/graphicsCard <-> graphics
 *   touchscreen   <-> touch
 */
import { num, str } from "./firestore-sanitize";

export interface ProductOption {
  /** Display value, e.g. "16GB" / "512GB SSD" / "1 Year Warranty". */
  value: string;
  /** Rupees added to (or subtracted from) the base price when selected. */
  priceAdjustment: number;
  active: boolean;
  /** Optional per-option stock. Omitted when not tracked. */
  stock?: number;
  /** Marks the option preselected on the customer website. */
  isDefault?: boolean;
}

export type OptionKind = "ram" | "storage" | "warranty";

export const OPTION_FIELD: Record<OptionKind, "ramOptions" | "storageOptions" | "warrantyOptions"> = {
  ram: "ramOptions",
  storage: "storageOptions",
  warranty: "warrantyOptions",
};

export const OPTION_LABEL: Record<OptionKind, string> = {
  ram: "RAM",
  storage: "Storage",
  warranty: "Warranty",
};

/** Normalises one raw option entry (string or object) into a clean option. */
export function normalizeOption(raw: unknown): ProductOption | null {
  if (typeof raw === "string") {
    const value = raw.trim();
    return value ? { value, priceAdjustment: 0, active: true } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const value = str(o.value ?? o.label ?? o.name ?? o.title);
  if (!value) return null;
  const opt: ProductOption = {
    value,
    priceAdjustment: num(o.priceAdjustment ?? o.price ?? o.delta ?? o.extra ?? 0, 0),
    active: o.active === undefined ? true : o.active !== false,
  };
  if (o.stock !== undefined && o.stock !== null && o.stock !== "") {
    opt.stock = num(o.stock, 0);
  }
  if (o.isDefault === true || o.default === true) opt.isDefault = true;
  return opt;
}

export function normalizeOptions(raw: unknown): ProductOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductOption[] = [];
  for (const item of raw) {
    const o = normalizeOption(item);
    if (o) out.push(o);
  }
  return out;
}

/** Touch is stored as a boolean but has historically been "Yes"/"No" strings. */
export function normalizeTouch(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  const s = str(raw).toLowerCase();
  return s === "yes" || s === "true" || s === "touch" || s === "touchscreen" || s === "1";
}

export interface HardwareSpecs {
  processor: string;
  generation: string;
  screenSize: string;
  ram: string;
  storage: string;
  graphics: string;
  touch: boolean;
  operatingSystem: string;
}

/** Reads hardware specs from a product doc, honouring every legacy field name. */
export function readHardwareSpecs(p: Record<string, unknown> | null | undefined): HardwareSpecs {
  const d = (p ?? {}) as Record<string, unknown>;
  const specs = Array.isArray(d.specs) ? (d.specs as unknown[]).map((s) => str(s)) : [];
  return {
    processor: str(d.processor) || specs[0] || "",
    generation: str(d.generation) || str(d.gen) || "",
    screenSize: str(d.screenSize) || str(d.screen) || str(d.display) || str(d.screen_size) || "",
    ram: str(d.ram) || specs[1] || "",
    storage: str(d.storage) || str(d.ssd) || specs[2] || "",
    graphics: str(d.graphics) || str(d.gpu) || str(d.graphicsCard) || "",
    touch: normalizeTouch(d.touch ?? d.touchscreen ?? d.touchScreen),
    operatingSystem: str(d.operatingSystem) || str(d.os) || "",
  };
}

/**
 * Builds the Firestore payload for hardware specs.
 * Canonical names + legacy mirrors so BOTH the current customer website and
 * any older reader resolve the same values (fixes "Screen Size —",
 * "Generation —", "Graphics —" on the product page).
 */
export function buildSpecPayload(s: HardwareSpecs): Record<string, unknown> {
  return {
    // canonical
    processor: s.processor,
    generation: s.generation,
    screenSize: s.screenSize,
    ram: s.ram,
    storage: s.storage,
    graphics: s.graphics,
    touch: s.touch,
    operatingSystem: s.operatingSystem,
    // legacy mirrors (read by older customer-site builds)
    os: s.operatingSystem,
    screen: s.screenSize,
    gen: s.generation,
    gpu: s.graphics,
    touchscreen: s.touch,
    // human-readable summary rows used by product cards / spec tables
    specs: [s.processor, s.ram, s.storage].filter(Boolean),
    specSheet: [
      { label: "Processor", value: s.processor },
      { label: "Generation", value: s.generation },
      { label: "Screen Size", value: s.screenSize },
      { label: "RAM", value: s.ram },
      { label: "Storage", value: s.storage },
      { label: "Graphics", value: s.graphics },
      { label: "Touch", value: s.touch ? "Yes" : "No" },
      { label: "Operating System", value: s.operatingSystem },
    ].filter((r) => !!r.value),
  };
}

/**
 * Final price for a configuration.
 * There is NO hardcoded ₹5000 anywhere — every adjustment comes from the
 * per-product options defined by the admin.
 */
export function computeConfiguredPrice(
  basePrice: number,
  selected: { ram?: ProductOption | null; storage?: ProductOption | null; warranty?: ProductOption | null }
): number {
  return (
    num(basePrice) +
    num(selected.ram?.priceAdjustment) +
    num(selected.storage?.priceAdjustment) +
    num(selected.warranty?.priceAdjustment)
  );
}

/** Default (preselected) option for a list: explicit default, else first active. */
export function defaultOption(options: ProductOption[]): ProductOption | null {
  return options.find((o) => o.isDefault && o.active) ?? options.find((o) => o.active) ?? null;
}


/* ================= Taxonomy & identifier helpers ================= */

/** URL-safe slug. Never returns a Firestore document id. */
export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/**
 * Reads the category NAME from a product document, tolerating every legacy
 * shape seen in this project: `category` (string), `categoryName`,
 * `category: { name }`, or a bare `categoryId` with no name.
 */
export function readCategoryName(p: Record<string, unknown> | null | undefined): string {
  const d = (p ?? {}) as Record<string, unknown>;
  const raw = d.category;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const name = (raw as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return str(d.categoryName) || "";
}

/** True when a product still carries the old variants[] price structure. */
export function hasLegacyVariants(p: Record<string, unknown> | null | undefined): boolean {
  const v = (p ?? {})["variants"];
  return Array.isArray(v) && v.length > 0;
}
