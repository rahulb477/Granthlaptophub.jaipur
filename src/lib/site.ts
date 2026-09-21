import { db } from "@/db";
import { settings } from "@/db/schema";

export const SETTING_KEYS = [
  "site",
  "appearance",
  "seo",
  "trustBar",
  "header",
  "hero",
  "sections",
  "bestSellers",
  "trending",
  "spotlight",
  "videos",
  "blog",
  "policies",
  "card",
  "footer",
  "pages",
  "search",
  "whatsapp",
  "notifications",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const IMG = {
  mac: "https://images.pexels.com/photos/249535/pexels-photo-249535.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  store: "https://images.pexels.com/photos/17565491/pexels-photo-17565491.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
};

export const DEFAULTS: Record<SettingKey, any> = {
  site: {
    businessName: "Maa Karni Computer",
    city: "Jodhpur",
    tagline: "Jodhpur's trusted laptop destination",
    phone: "+91 76656 18720",
    whatsapp: "917665618720",
    email: "info@maakarnicomputer.in",
    address: "Maa Karni Computer, Sardar Market, Jodhpur, Rajasthan 342001",
    hours: [
      { day: "Monday – Saturday", time: "10:30 AM – 8:30 PM" },
      { day: "Sunday", time: "11:00 AM – 2:00 PM" },
    ],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Sardar+Market+Jodhpur",
    instagramUrl: "https://www.instagram.com/laptopmaakarnicomputerjodhpur",
    instagramHandle: "@laptopmaakarnicomputerjodhpur",
    instagramVisible: true,
    logoUrl: "",
    favicon: "",
    currency: "₹",
  },
  appearance: {
    primary: "#132033",
    accent: "#C89B3C",
    accent2: "#E6BD63",
    bg: "#F6F3EC",
    surface: "#FFFFFF",
    text: "#233140",
    muted: "#66748A",
    line: "#E6E0D2",
    radius: "14px",
    buttonStyle: "gold",
  },
  seo: {
    siteTitle: "Maa Karni Computer Jodhpur – Genuine Laptops at Best Prices",
    metaDescription:
      "Buy new & refurbished laptops in Jodhpur at Maa Karni Computer. Genuine billed products, warranty assistance, EMI & COD. Dell, HP, Lenovo, Apple, Asus.",
    keywords: "laptops jodhpur, laptop store jodhpur, refurbished laptops jodhpur, dell hp lenovo apple jodhpur",
    ogImage: IMG.mac,
    pages: {
      home: { title: "", desc: "" },
      shop: { title: "Shop Laptops in Jodhpur", desc: "" },
      about: { title: "About Maa Karni Computer Jodhpur", desc: "" },
      contact: { title: "Contact Maa Karni Computer Jodhpur", desc: "" },
      compare: { title: "Compare Laptops", desc: "" },
    },
  },
  trustBar: {
    enabled: true,
    items: [
      { id: "t1", icon: "wallet", text: "EMI available on select laptops" },
      { id: "t2", icon: "badge", text: "100% genuine, billed products" },
      { id: "t3", icon: "shield", text: "Warranty assistance in Jodhpur" },
      { id: "t4", icon: "store", text: "Trusted local store since 2010" },
    ],
  },
  header: {
    enabled: true,
    siteName: "MAA KARNI COMPUTER",
    tagline: "J O D H P U R",
    searchPlaceholder: "Search laptops, brands, specs…",
    showSearch: true,
    showCart: true,
    showAccount: true,
    showMenu: true,
    nav: [
      { id: "home", label: "Home", href: "/", system: true },
      { id: "shop", label: "Shop Laptops", href: "/shop", system: true },
      { id: "compare", label: "Compare", href: "/compare" },
      { id: "about", label: "About", href: "/about" },
      { id: "contact", label: "Contact", href: "/contact" },
    ],
  },
  hero: {
    enabled: true,
    badge: "Maa Karni Computer · Sardar Market, Jodhpur",
    heading: "Laptops that earn their keep, at prices that make sense",
    highlight: "prices that make sense",
    description:
      "New and refurbished laptops from Dell, HP, Lenovo, Apple and Asus — genuine billing, warranty assistance and honest advice, from Jodhpur's trusted computer store.",
    trust: [
      { id: "h1", icon: "badge", title: "Genuine", desc: "Billed products", visible: true },
      { id: "h2", icon: "shield", title: "Warranty", desc: "Full assistance", visible: true },
      { id: "h3", icon: "wallet", title: "EMI", desc: "Easy options", visible: true },
      { id: "h4", icon: "refresh", title: "Exchange", desc: "Old for new", visible: true },
    ],
    productId: null,
    productBadge: "Store Best Seller",
    condition: "",
    offerText: "Genuine billing · Exchange accepted",
    ctaText: "Shop Laptops",
    ctaHref: "/shop",
    showBottomOffer: true,
    bottomLabel: "Budget deals start at",
    bottomPrice: 32990,
    bottomText: "Refurbished business laptops, quality checked",
    bottomCta: "See Budget Laptops",
    bottomCtaHref: "/shop?max=40000",
    bottomWa: "Ask on WhatsApp",
    bg: "#F3EEE1",
    bgImage: "",
    rays: true,
    overlay: 0,
  },
  sections: {
    order: ["bestSellers", "spotlight", "trending", "offers", "videos", "blog"],
    visibility: { bestSellers: true, spotlight: true, trending: true, offers: true, videos: true, blog: true },
  },
  bestSellers: {
    enabled: true,
    eyebrow: "Customer favourites",
    heading: "Best Sellers",
    description: "The laptops Jodhpur keeps coming back for.",
    viewAllText: "View All Laptops",
    viewAllHref: "/shop",
    mode: "auto",
    productIds: [],
    count: 4,
  },
  trending: {
    enabled: true,
    eyebrow: "Hot right now",
    heading: "Trending Laptops",
    description: "Fresh stock and rising picks this week.",
    viewAllText: "View Trending",
    viewAllHref: "/shop?tag=Trending",
    mode: "auto",
    productIds: [],
    count: 4,
  },
  spotlight: {
    enabled: true,
    eyebrow: "Deal of the day",
    heading: "Today's Spotlight",
    productId: null,
    badge: "Live Deal",
    offerText: "",
    warrantyText: "Brand warranty with in-store assistance",
    genuineText: "100% genuine, billed product",
    emiText: "EMI available",
    ctaText: "Order on WhatsApp",
    viewDetailsText: "View Details",
    startAt: "",
    endAt: "",
    active: true,
  },
  videos: {
    enabled: true,
    eyebrow: "Watch & explore",
    heading: "Reviews & Walkthroughs",
    description: "Watch before you buy — real hands-on with the laptops we stock.",
  },
  blog: {
    enabled: true,
    eyebrow: "Tech tips & guides",
    heading: "Guides that save you money",
    description: "Buying advice, comparisons and care tips from the Maa Karni desk.",
    count: 3,
    featuredOnly: false,
  },
  policies: {
    warrantyText: "Every laptop ships with its brand warranty plus our in-store warranty assistance.",
    warrantyDays: "Up to 3 years (model dependent)",
    returnText: "7-day replacement for manufacturing defects, subject to brand terms.",
    returnDays: "7 days",
    codEnabled: true,
    codText: "Cash on Delivery available in Jodhpur",
    emiEnabled: true,
    emiText: "No-cost & card EMI options available",
    genuineText: "100% genuine, billed products",
    qualityText: "Quality checked before delivery",
    serviceText: "Free setup & service support",
  },
  card: {
    showBrand: true,
    showStock: true,
    showRating: true,
    showReviews: true,
    showProcessor: true,
    showRam: true,
    showStorage: true,
    showOs: false,
    showUsage: true,
    showPrice: true,
    showMrp: true,
    showDiscount: true,
    showSavings: true,
    showWarranty: false,
    showAddToCart: true,
    showWhatsapp: true,
    showDetails: true,
    showCompare: true,
    addToCartText: "Add to Cart",
    detailsText: "View Details",
    waText: "Enquire",
    inStockText: "In Stock",
    lowStockText: "Only few left",
    outOfStockText: "Out of Stock",
    compareText: "Compare",
    compareFields: [
      { key: "processor", label: "Processor" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "screen", label: "Display" },
      { key: "graphics", label: "Graphics" },
      { key: "os", label: "Operating System" },
      { key: "battery", label: "Battery" },
      { key: "weight", label: "Weight" },
      { key: "warranty", label: "Warranty" },
      { key: "price", label: "Price" },
    ],
  },
  footer: {
    brandName: "MAA KARNI COMPUTER",
    cityLabel: "Sardar Market, Jodhpur",
    description:
      "Jodhpur's trusted destination for genuine laptops — new & refurbished, with warranty assistance, EMI and local service support.",
    trust: [
      { icon: "badge", text: "Genuine Products" },
      { icon: "shield", text: "Warranty Assistance" },
      { icon: "wallet", text: "Cash / UPI / EMI" },
      { icon: "headset", text: "Local Service Support" },
    ],
    shopLinks: [
      { label: "All Laptops", href: "/shop" },
      { label: "New Laptops", href: "/shop?condition=new" },
      { label: "Refurbished", href: "/shop?condition=refurbished" },
      { label: "Gaming Laptops", href: "/shop?tag=Gaming" },
      { label: "MacBooks", href: "/shop?brand=apple" },
    ],
    budgetLinks: [
      { label: "Under ₹20K", min: 0, max: 20000 },
      { label: "₹20K – ₹40K", min: 20000, max: 40000 },
      { label: "₹40K – ₹70K", min: 40000, max: 70000 },
      { label: "Above ₹70K", min: 70000, max: 0 },
    ],
    companyLinks: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Compare Laptops", href: "/compare" },
      { label: "Cart", href: "/cart" },
    ],
    copyright: "© 2024 Maa Karni Computer, Jodhpur. All rights reserved.",
  },
  pages: {
    about: {
      heading: "The store Jodhpur trusts for laptops",
      description:
        "Maa Karni Computer has served students, professionals and businesses across Jodhpur with genuine laptops, honest pricing and service that keeps working after the sale.",
      story: [
        "What began as a small counter in Sardar Market has grown into one of Jodhpur's most trusted names in laptops. Every machine we sell — new or refurbished — passes through our own hands before it reaches yours.",
        "We stock business workhorses, student-friendly notebooks and gaming laptops from Dell, HP, Lenovo, Apple and Asus. If you can't find what you need on the website, call us — if it exists, we can get it in Jodhpur within days.",
      ],
      trustPoints: [
        { icon: "store", title: "Local & Trusted", desc: "A physical store in Sardar Market you can walk into anytime." },
        { icon: "badge", title: "Genuine Billing", desc: "Every product billed with proper paperwork and brand warranty." },
        { icon: "wrench", title: "Service Desk", desc: "Repairs, upgrades and data migration after the sale." },
        { icon: "wallet", title: "EMI & Exchange", desc: "Easy EMI options and honest exchange for your old machine." },
      ],
      info: {
        established: "2010",
        stock: "New & refurbished stock",
        support: "In-store service desk",
        delivery: "Same-day Jodhpur delivery",
      },
      image: IMG.store,
    },
    contact: {
      heading: "Visit the store or get in touch",
      description:
        "Call, WhatsApp or drop by Sardar Market. We answer faster on WhatsApp during store hours.",
      formFields: { name: true, phone: true, email: true, message: true },
      formSuccess: "Thanks! Your enquiry is logged — we'll reach out within store hours.",
      profileFields: { name: true, phone: true, city: true },
    },
  },
  search: {
    placeholder: "Search laptops, brands, specs…",
    enabled: true,
    limit: 48,
    suggestions: ["i5 16GB", "Refurbished", "Gaming", "MacBook", "Under 40K"],
  },
  whatsapp: {
    number: "917665618720",
    defaultMessage: "Hi Maa Karni Computer! I have a question about your laptops.",
    productMessage: "Hi! I'm interested in {product} ({price}). Is it available?",
    ctaText: "Chat on WhatsApp",
    floating: true,
  },
  notifications: {
    orderAlerts: true,
    enquiryAlerts: true,
    lowStockAlerts: true,
    lowStockThreshold: 5,
    adminEmail: "",
  },
};

export async function getAllSettings(): Promise<Record<SettingKey, any>> {
  const rows = await db.select().from(settings);
  const out = {} as Record<SettingKey, any>;
  for (const key of SETTING_KEYS) out[key] = { ...DEFAULTS[key] };
  for (const r of rows) {
    if (r.key in out) out[r.key as SettingKey] = { ...DEFAULTS[r.key as SettingKey], ...(r.value ?? {}) };
  }
  return out;
}

export async function getSetting<K extends SettingKey>(key: K) {
  const all = await getAllSettings();
  return all[key];
}

/* ---------- small shared helpers ---------- */
export function inr(n: number | null | undefined) {
  return "₹" + (n ?? 0).toLocaleString("en-IN");
}
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}
export function discountPct(mrp: number | null | undefined, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
export function waLink(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
export function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{6,20})/) ||
    url.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
