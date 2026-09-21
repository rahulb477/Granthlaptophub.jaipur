/* Seed script — run with: npx tsx src/db/seed.ts */
import "dotenv/config";
import crypto from "node:crypto";
import { db } from "./index";
import * as S from "./schema";

const hash = (pw: string) => {
  const s = crypto.randomBytes(16).toString("hex");
  return `${s}:${crypto.scryptSync(pw, s, 32).toString("hex")}`;
};

const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200`;

async function main() {
  const existing = await db.select().from(S.adminUsers).limit(1);
  if (existing.length) {
    console.log("Database already seeded — skipping.");
    return;
  }
  console.log("Seeding Maa Karni Computer Jodhpur…");

  /* ---------- admin users ---------- */
  await db.insert(S.adminUsers).values([
    { name: "Karni Sharma", email: "admin@maakarni.com", passwordHash: hash("MaaKarni@123"), role: "superadmin" },
    { name: "Store Manager", email: "manager@maakarni.com", passwordHash: hash("Manager@123"), role: "admin" },
    { name: "Counter Staff", email: "staff@maakarni.com", passwordHash: hash("Staff@123"), role: "staff" },
  ]);

  /* ---------- brands ---------- */
  const brandRows = await db
    .insert(S.brands)
    .values([
      { name: "Dell", slug: "dell", sortOrder: 1 },
      { name: "HP", slug: "hp", sortOrder: 2 },
      { name: "Lenovo", slug: "lenovo", sortOrder: 3 },
      { name: "Apple", slug: "apple", sortOrder: 4 },
      { name: "ASUS", slug: "asus", sortOrder: 5 },
      { name: "Acer", slug: "acer", sortOrder: 6 },
    ])
    .returning();
  const bid = (n: string) => brandRows.find((b) => b.name === n)!.id;

  /* ---------- categories ---------- */
  const catRows = await db
    .insert(S.categories)
    .values([
      { name: "Business Laptops", slug: "business-laptops", description: "Workhorses for office and professional use", icon: "laptop", sortOrder: 1, featured: true },
      { name: "Student Laptops", slug: "student-laptops", description: "Everyday machines for college and study", icon: "star", sortOrder: 2, featured: true },
      { name: "Gaming Laptops", slug: "gaming-laptops", description: "High-refresh displays and dedicated graphics", icon: "play", sortOrder: 3 },
      { name: "MacBooks", slug: "macbooks", description: "Apple silicon — M1 and M2", icon: "badge", sortOrder: 4, featured: true },
      { name: "Refurbished", slug: "refurbished", description: "Quality-checked pre-owned business laptops", icon: "refresh", sortOrder: 5, featured: true },
    ])
    .returning();
  const cid = (n: string) => catRows.find((c) => c.name === n)!.id;

  /* ---------- products ---------- */
  const now = new Date();
  const dAgo = (n: number) => new Date(now.getTime() - n * 864e5);
  const prods = await db
    .insert(S.products)
    .values([
      {
        name: "Dell Inspiron 15 3525 (i5-1335U)", slug: "dell-inspiron-15-3525", brandId: bid("Dell"), categoryId: cid("Business Laptops"),
        sku: "DL-INS-3525", condition: "new", status: "published", stockQty: 8,
        images: [px(8533387), px(12882908)],
        description: "The dependable all-rounder for office work and heavy multitasking.",
        about: "12th Gen Intel Core i5, 16GB RAM and a 512GB SSD in a sturdy 15.6-inch chassis.\nPaired with Windows 11 and a 1-year on-site brand warranty.\nGreat pick for professionals who keep ten tabs and three apps open at once.",
        screen: '15.6" FHD (1920×1080) Anti-glare', processor: "Intel Core i5-1335U", generation: "13th Gen",
        ram: "16GB", storage: "512GB SSD", graphics: "Intel Iris Xe", os: "Windows 11 Home", touch: false,
        battery: "42Wh", ports: "USB-C 3.2, 2× USB-A, HDMI, SD reader, 3.5mm", weight: "1.92 kg",
        customSpecs: [{ label: "Color", value: "Silver" }, { label: "Webcam", value: "720p with physical shutter" }],
        price: 54990, mrp: 72990, emiMonthly: 1466,
        warranty: "1 Year On-site Brand Warranty", warrantyDesc: "Includes accidental damage protection add-on available at the store.",
        returnEligible: true, returnPeriod: "7 days", returnDesc: "Manufacturing defects only, subject to brand terms.",
        tags: ["Bestseller", "Business"],
        variants: [
          { key: "ram", name: "RAM", options: [{ label: "16GB", delta: 0, available: true, isDefault: true }, { label: "32GB", delta: 4000, available: true, isDefault: false }] },
          { key: "storage", name: "Storage", options: [{ label: "512GB SSD", delta: 0, available: true, isDefault: true }, { label: "1TB SSD", delta: 3500, available: true, isDefault: false }] },
        ],
        seoTitle: "Dell Inspiron 15 3525 Price in Jodhpur", seoDesc: "Dell Inspiron 15 3525 i5 1335U, 16GB RAM, 512GB SSD at Maa Karni Computer Jodhpur.",
        createdAt: dAgo(40), updatedAt: dAgo(2),
      },
      {
        name: "HP Pavilion 14 (i5-1235U)", slug: "hp-pavilion-14", brandId: bid("HP"), categoryId: cid("Business Laptops"),
        sku: "HP-PAV-14", condition: "new", status: "published", stockQty: 6,
        images: [px(8534377), px(8533587)],
        description: "Slim 14-inch daily driver with a sharp FHD panel.",
        about: "12th Gen i5 with 16GB RAM in a thin 1.4kg chassis.\nFingerprint reader and backlit keyboard as standard.",
        screen: '14" FHD IPS Micro-edge', processor: "Intel Core i5-1235U", generation: "12th Gen",
        ram: "16GB", storage: "512GB SSD", graphics: "Intel Iris Xe", os: "Windows 11 Home", touch: false,
        battery: "41Wh", ports: "USB-C 3.2, 2× USB-A, HDMI 2.1, 3.5mm", weight: "1.41 kg",
        price: 62490, mrp: 79990, emiMonthly: 1666,
        warranty: "1 Year Brand Warranty", returnEligible: true, returnPeriod: "7 days",
        tags: ["Bestseller", "Business"],
        createdAt: dAgo(35), updatedAt: dAgo(4),
      },
      {
        name: "Lenovo IdeaPad Slim 3 (Ryzen 5)", slug: "lenovo-ideapad-slim-3", brandId: bid("Lenovo"), categoryId: cid("Student Laptops"),
        sku: "LN-IDP-S3", condition: "new", status: "published", stockQty: 10,
        images: [px(5082979)],
        description: "The value pick for college — 16GB RAM out of the box.",
        about: "Ryzen 5 7530U with 16GB RAM and 512GB SSD in a 16-inch WUXGA panel.\nLight, long battery life, and a spill-resistant keyboard.",
        screen: '16" WUXGA (1920×1200) IPS', processor: "AMD Ryzen 5 7530U", generation: "Ryzen 7000",
        ram: "16GB", storage: "512GB SSD", graphics: "AMD Radeon Graphics", os: "Windows 11 Home", touch: false,
        battery: "57Wh", ports: "USB-C, 2× USB-A, HDMI, 3.5mm", weight: "1.62 kg",
        price: 48990, mrp: 61990,
        warranty: "1 Year Brand Warranty", returnEligible: true, returnPeriod: "7 days",
        tags: ["Student", "Everyday"],
        createdAt: dAgo(30), updatedAt: dAgo(1),
      },
      {
        name: "Apple MacBook Air 13 (M1)", slug: "apple-macbook-air-13-m1", brandId: bid("Apple"), categoryId: cid("MacBooks"),
        sku: "AP-MBA-M1", condition: "new", status: "published", stockQty: 5,
        images: [px(249535), px(10948188)],
        description: "The M1 Air — silent, fast, and all-day battery.",
        about: "Apple M1 chip, 8GB unified memory, 256GB SSD.\nFanless design, Retina display, 18-hour battery.\nSealed Apple India billing with full brand warranty.",
        screen: '13.3" Retina (2560×1600)', processor: "Apple M1", generation: "M1",
        ram: "8GB", storage: "256GB SSD", graphics: "Apple M1 7-core GPU", os: "macOS", touch: false,
        battery: "Up to 18 hours", ports: "2× Thunderbolt/USB-C, 3.5mm", weight: "1.29 kg",
        price: 65990, mrp: 83900,
        warranty: "1 Year Apple India Warranty", warrantyDesc: "AppleCare+ add-on available in-store.",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Bestseller", "Trending"],
        createdAt: dAgo(28), updatedAt: dAgo(1),
      },
      {
        name: "ASUS VivoBook 15 (Ryzen 5)", slug: "asus-vivobook-15", brandId: bid("ASUS"), categoryId: cid("Student Laptops"),
        sku: "AS-VBK-15", condition: "new", status: "published", stockQty: 7,
        images: [px(12882905)],
        description: "Thin, light and affordable for everyday use.",
        about: "Ryzen 5 7520U with 8GB RAM and 512GB SSD.\nNarrow bezels and a light 1.7kg body.",
        screen: '15.6" FHD', processor: "AMD Ryzen 5 7520U", generation: "Ryzen 7000",
        ram: "8GB", storage: "512GB SSD", graphics: "AMD Radeon Graphics", os: "Windows 11 Home", touch: false,
        battery: "50Wh", ports: "2× USB-A, USB-C, HDMI, 3.5mm", weight: "1.7 kg",
        price: 42990, mrp: 55990,
        warranty: "1 Year Brand Warranty", returnEligible: true, returnPeriod: "7 days",
        tags: ["Student", "Everyday"],
        createdAt: dAgo(25), updatedAt: dAgo(6),
      },
      {
        name: "Dell Latitude 5420 (Refurbished)", slug: "dell-latitude-5420-refurb", brandId: bid("Dell"), categoryId: cid("Refurbished"),
        sku: "DL-LAT-5420-R", condition: "refurbished", status: "published", stockQty: 3,
        images: [px(8534153)],
        description: "Corporate-grade 14-inch, quality checked and warranted.",
        about: "Ex-corporate Dell Latitude 5420, 10/10 graded in our own shop.\nNew SSD fitted, battery health 85%+, full brand warranty remaining.\nOur best value-per-rupee business laptop.",
        screen: '14" FHD', processor: "Intel Core i5-1135G7", generation: "11th Gen",
        ram: "16GB", storage: "256GB SSD", graphics: "Intel Iris Xe", os: "Windows 10 Pro (upgradeable)", touch: false,
        battery: "51Wh (health 85%)", ports: "USB-C TB4, 2× USB-A, HDMI", weight: "1.4 kg",
        customSpecs: [{ label: "Grade", value: "A+ (ex-corporate, 10/10)" }],
        price: 32990, mrp: 54990,
        warranty: "6 Months Maa Karni Warranty", warrantyDesc: "In-store support for the full warranty period, plus any remaining brand warranty.",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Trending", "Business"],
        variants: [
          { key: "ram", name: "RAM Upgrade", options: [{ label: "16GB", delta: 0, available: true, isDefault: true }, { label: "32GB", delta: 3000, available: true, isDefault: false }] },
        ],
        createdAt: dAgo(20), updatedAt: dAgo(0),
      },
      {
        name: "HP EliteBook 840 G7 (Refurbished)", slug: "hp-elitebook-840-g7-refurb", brandId: bid("HP"), categoryId: cid("Refurbished"),
        sku: "HP-EB-840G7-R", condition: "refurbished", status: "published", stockQty: 4,
        images: [px(12882907)],
        description: "Premium 14-inch business class, refreshed and warranted.",
        about: "EliteBook 840 G7 with i5-10210U, 16GB RAM and 512GB SSD.\nBacklit keyboard, fingerprint reader, 4G option.\nCorporate machine at half the new price.",
        screen: '14" FHD', processor: "Intel Core i5-10210U", generation: "10th Gen",
        ram: "16GB", storage: "512GB SSD", graphics: "Intel UHD", os: "Windows 10 Pro", touch: false,
        battery: "56Wh (health 80%)", ports: "2× Thunderbolt 3, 2× USB-A, HDMI", weight: "1.36 kg",
        price: 38990, mrp: 68000,
        warranty: "6 Months Maa Karni Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Trending", "Pro Workstation"],
        createdAt: dAgo(18), updatedAt: dAgo(3),
      },
      {
        name: "Lenovo ThinkPad E14 Gen 4 (Ryzen 5)", slug: "lenovo-thinkpad-e14-gen4", brandId: bid("Lenovo"), categoryId: cid("Business Laptops"),
        sku: "LN-TP-E14G4", condition: "new", status: "published", stockQty: 6,
        images: [px(129208)],
        description: "ThinkPad keyboard, enterprise durability, mid-range price.",
        about: "Ryzen 5 7530U with 16GB RAM in the legendary E-series chassis.\nMIL-SPEC tested, spill-resistant keyboard, optional docking support.",
        screen: '14" WUXGA (1920×1200) IPS', processor: "AMD Ryzen 5 7530U", generation: "Ryzen 7000",
        ram: "16GB", storage: "512GB SSD", graphics: "AMD Radeon Graphics", os: "Windows 11 Pro", touch: false,
        battery: "52.5Wh", ports: "2× USB-A, USB-C, HDMI, RJ45, 3.5mm", weight: "1.4 kg",
        price: 52990, mrp: 66990,
        warranty: "1 Year On-site Brand Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Business", "Pro Workstation"],
        createdAt: dAgo(15), updatedAt: dAgo(5),
      },
      {
        name: "ASUS TUF Gaming A15 (RTX 3050)", slug: "asus-tuf-gaming-a15", brandId: bid("ASUS"), categoryId: cid("Gaming Laptops"),
        sku: "AS-TUF-A15", condition: "new", status: "published", stockQty: 3,
        images: [px(6053283), px(5548042)],
        description: "144Hz gaming with RTX 3050 at a sensible price.",
        about: "Ryzen 7 7735HS + RTX 3050 with 144Hz 15.6-inch panel.\nMIL-STD-810H tested chassis, per-key RGB.\nHandles 1080p AAA titles at high settings.",
        screen: '15.6" FHD 144Hz', processor: "AMD Ryzen 7 7735HS", generation: "Ryzen 7000",
        ram: "16GB", storage: "512GB SSD", graphics: "NVIDIA RTX 3050 4GB", os: "Windows 11 Home", touch: false,
        battery: "90Wh", ports: "USB-C 10Gbps, 3× USB-A, HDMI 2.1, 3.5mm", weight: "2.2 kg",
        price: 78990, mrp: 99990, emiMonthly: 2111,
        warranty: "2 Year On-site Brand Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Gaming"],
        createdAt: dAgo(12), updatedAt: dAgo(2),
      },
      {
        name: "HP 250 G9 (i5-1235U)", slug: "hp-250-g9", brandId: bid("HP"), categoryId: cid("Student Laptops"),
        sku: "HP-250-G9", condition: "new", status: "published", stockQty: 2,
        images: [px(7610458)],
        description: "Simple, tough and affordable — a solid first laptop.",
        about: "i5-1235U with 8GB RAM and 512GB SSD in a 15.6-inch package.\nThe most-affordable i5 we stock.",
        screen: '15.6" FHD', processor: "Intel Core i5-1235U", generation: "12th Gen",
        ram: "8GB", storage: "512GB SSD", graphics: "Intel Iris Xe", os: "Windows 11 Home", touch: false,
        battery: "41Wh", ports: "USB-C, 2× USB-A, HDMI, 3.5mm", weight: "1.59 kg",
        price: 41990, mrp: 54990,
        warranty: "1 Year Brand Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Student", "Everyday"],
        createdAt: dAgo(10), updatedAt: dAgo(1),
      },
      {
        name: "Acer Aspire 5 (i5-1235U)", slug: "acer-aspire-5", brandId: bid("Acer"), categoryId: cid("Student Laptops"),
        sku: "AC-ASP-5", condition: "new", status: "published", stockQty: 0,
        images: [px(8533587)],
        description: "Popular 15-inch — restocking soon.",
        about: "i5-1235U, 8GB RAM, 512GB SSD. Currently sold out — ask on WhatsApp for restock timing or exchange with a similar model.",
        screen: '15.6" FHD', processor: "Intel Core i5-1235U", generation: "12th Gen",
        ram: "8GB", storage: "512GB SSD", graphics: "Intel Iris Xe", os: "Windows 11 Home", touch: false,
        battery: "50Wh", ports: "2× USB-A, USB-C, HDMI, 3.5mm", weight: "1.78 kg",
        price: 43990, mrp: 56990,
        warranty: "1 Year Brand Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Everyday"],
        createdAt: dAgo(22), updatedAt: dAgo(8),
      },
      {
        name: "Apple MacBook Pro 13 (M2)", slug: "apple-macbook-pro-13-m2", brandId: bid("Apple"), categoryId: cid("MacBooks"),
        sku: "AP-MBP-M2", condition: "new", status: "published", stockQty: 1,
        images: [px(249541), px(265144)],
        description: "M2 power in the classic 13-inch Pro body.",
        about: "Apple M2, 8GB unified memory, 256GB SSD with active cooling.\nFor creators who need sustained performance.",
        screen: '13.3" Retina (2560×1600)', processor: "Apple M2", generation: "M2",
        ram: "8GB", storage: "256GB SSD", graphics: "Apple M2 10-core GPU", os: "macOS", touch: false,
        battery: "Up to 20 hours", ports: "2× Thunderbolt 3, MagSafe 3, 3.5mm", weight: "1.4 kg",
        price: 109990, mrp: 129900, emiMonthly: 2916,
        warranty: "1 Year Apple India Warranty",
        returnEligible: true, returnPeriod: "7 days",
        tags: ["Featured", "New"],
        createdAt: dAgo(8), updatedAt: dAgo(0),
      },
    ])
    .returning();
  const pid = (slug: string) => prods.find((p) => p.slug === slug)!.id;

  /* ---------- customers ---------- */
  const cust = await db
    .insert(S.customers)
    .values([
      { name: "Rahul Sharma", email: "rahul.sharma@gmail.com", phone: "9414012345", city: "Jodhpur" },
      { name: "Priya Mehta", email: "priya.mehta@gmail.com", phone: "9929876543", city: "Jodhpur" },
      { name: "Amit Singh", email: "amit.singh@outlook.com", phone: "9782112233", city: "Udaipur" },
      { name: "Karan Patel", email: "karan.patel@gmail.com", phone: "9602334455", city: "Jodhpur" },
    ])
    .returning();

  const P = (slug: string, qty = 1, variant: Record<string, string> = {}) => {
    const p = prods.find((x) => x.slug === slug)!;
    let delta = 0;
    for (const dim of (p.variants as any[]) ?? []) {
      const o = (dim.options ?? []).find((x: any) => x.label === variant[dim.name]);
      if (o) delta += o.delta ?? 0;
    }
    return { productId: p.id, name: p.name, image: p.images[0], variant, qty, unitPrice: p.price + delta };
  };
  const sum = (items: any[]) => items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  const mkOrder = (no: number, ci: number, items: any[], status: string, days: number, payment = "cod", coupon = "", discount = 0) => {
    const c = cust[ci];
    const sub = sum(items);
    return {
      orderNo: `MKC-${no}`, customerId: c.id, name: c.name, email: c.email, phone: c.phone,
      address: "Sardar Bazaar, Jodhpur", items, subtotal: sub, discount, couponCode: coupon,
      total: sub - discount, paymentMethod: payment, status, createdAt: dAgo(days),
    };
  };
  await db.insert(S.orders).values([
    mkOrder(1001, 0, [P("dell-inspiron-15-3525")], "processing", 2, "upi"),
    mkOrder(1002, 1, [P("apple-macbook-air-13-m1"), P("asus-vivobook-15")], "confirmed", 4, "upi"),
    mkOrder(1003, 2, [P("hp-pavilion-14", 1, { RAM: "32GB" as any })], "delivered", 7, "cod"),
    mkOrder(1004, 3, [P("dell-latitude-5420-refurb", 2)], "delivered", 9),
    mkOrder(1005, 0, [P("asus-tuf-gaming-a15")], "pending", 0, "cod"),
    mkOrder(1006, 1, [P("hp-250-g9")], "cancelled", 12, "cod"),
  ]);

  /* ---------- enquiries ---------- */
  await db.insert(S.enquiries).values([
    { name: "Vikas Rao", phone: "9933445566", source: "whatsapp", productName: "Dell Inspiron 15 3525 (i5-1335U)", productId: pid("dell-inspiron-15-3525"), message: "Is the 32GB variant available with the 1TB SSD?", status: "new", createdAt: dAgo(0) },
    { name: "Simran Kaur", email: "simran.k@gmail.com", source: "website", productName: "Apple MacBook Air 13 (M1)", productId: pid("apple-macbook-air-13-m1"), message: "Can I take it home the same day? Do you take old laptop exchange?", status: "new", createdAt: dAgo(1) },
    { name: "Rohit Verma", phone: "9461552233", source: "whatsapp", productName: "ASUS TUF Gaming A15 (RTX 3050)", productId: pid("asus-tuf-gaming-a15"), message: "EMI options for student ID? Looking to buy this week.", status: "contacted", createdAt: dAgo(2) },
    { name: "Anjali Soni", email: "anjali.soni@gmail.com", phone: "9829001122", source: "website", productName: "Lenovo IdeaPad Slim 3 (Ryzen 5)", productId: pid("lenovo-ideapad-slim-3"), message: "College fest discount? Budget around 45k.", status: "interested", createdAt: dAgo(3) },
    { name: "Deepak Kumar", phone: "9025008877", source: "product", message: "Which refurbished model is best for office work under 40k?", status: "converted", createdAt: dAgo(5) },
  ]);

  /* ---------- reviews ---------- */
  await db.insert(S.reviews).values([
    { productId: pid("dell-inspiron-15-3525"), customerName: "Rahul S.", rating: 5, text: "Bought for my CA office. Billing was proper, warranty card done on the spot. Very helpful staff.", status: "approved", featured: true, createdAt: dAgo(6) },
    { productId: pid("dell-inspiron-15-3525"), customerName: "Mansi T.", rating: 4, text: "Good price compared to online. Keyboard feels cheap but for the price, no complaints.", status: "approved", createdAt: dAgo(14) },
    { productId: pid("apple-macbook-air-13-m1"), customerName: "Priya M.", rating: 5, text: "Sealed unit with Apple India warranty. They even helped with data transfer from my old Windows laptop.", status: "approved", featured: true, createdAt: dAgo(8) },
    { productId: pid("dell-latitude-5420-refurb"), customerName: "Karan P.", rating: 5, text: "Honestly looks brand new. They showed the battery report before I paid. 6 month store warranty gave me confidence.", status: "approved", createdAt: dAgo(5) },
    { productId: pid("asus-tuf-gaming-a15"), customerName: "Rohit V.", rating: 4, text: "Runs Valorant and COD fine at 144. Fan is loud under load but expected. Good deal at Jodhpur prices.", status: "approved", createdAt: dAgo(10) },
    { productId: pid("hp-pavilion-14"), customerName: "Amit S.", rating: 5, text: "Quick delivery to my office in Udaipur next day. Packaging was solid.", status: "pending", createdAt: dAgo(0) },
  ]);

  /* ---------- videos ---------- */
  await db.insert(S.videos).values([
    { title: "Dell Inspiron 15 — in-store walkthrough", description: "Hands-on with the Inspiron 3525: build, ports, battery and real-world speed.", youtubeUrl: "https://www.youtube.com/results?search_query=dell+inspiron+15+3525+review", thumbnail: px(8533387), category: "Walkthrough", sortOrder: 1 },
    { title: "MacBook Air M1 vs Windows laptops under ₹70k", description: "Where the M1 still wins and where a good Windows machine gives more value.", youtubeUrl: "https://www.youtube.com/results?search_query=macbook+air+m1+vs+windows+laptop", thumbnail: px(249535), category: "Reviews", sortOrder: 2 },
    { title: "How to choose a laptop under ₹50,000", description: "Our buying desk explains RAM, storage and warranty traps to avoid.", youtubeUrl: "https://www.youtube.com/results?search_query=best+laptop+under+50000+india", thumbnail: px(5082979), category: "Buying Guide", sortOrder: 3 },
  ]);

  /* ---------- blog ---------- */
  const article = (title: string, slug: string, category: string, image: string, excerpt: string, content: string, days: number, featured: boolean, tags: string[]) => ({
    title, slug, category, image, excerpt, content, author: "Maa Karni Team",
    publishDate: dAgo(days), published: true, featured, tags,
    seoTitle: `${title} | Maa Karni Computer Jodhpur`, seoDesc: excerpt.slice(0, 150),
  });
  await db.insert(S.blogPosts).values([
    article(
      "How to choose the right laptop for college",
      "laptop-for-college-guide", "Buying Guide", px(5082979),
      "16GB RAM is the new floor, battery beats benchmarks, and warranty matters more than the spec sheet. Here's what our counter advice looks like in writing.",
      "Every semester we help dozens of students pick a laptop. Here's the exact checklist we run.\n\n### What actually matters for college\n\n- **16GB RAM minimum** — browsers eat memory; 8GB feels slow within a year\n- **512GB SSD** — 256GB fills up with projects and media fast\n- **Battery over benchmarks** — a 57Wh battery survives a full lecture day\n- **Weight under 1.7kg** — you're carrying it everywhere\n\n### Where to save money\n\n- Skip 2-in-1 and touchscreen models unless you need to draw on screen\n- Last generation processors are often 20% cheaper with no real-world loss\n- Exchange your old laptop for an honest on-the-spot quote\n\nBring your budget and what you study to the store — we'll shortlist three machines and talk you through the trade-offs.",
      6, true, ["student", "buying-guide"]
    ),
    article(
      "Refurbished vs new: when a refurbished laptop is the smart buy",
      "refurbished-vs-new-laptops", "Guides", px(8534153),
      "A quality-checked ex-corporate business laptop can outlive a cheap brand-new one. Here's how to tell genuine refurb from risky ones.",
      "Refurbished has a bad reputation it doesn't deserve — if it's done properly.\n\n### What 'properly' means\n\n- The machine is **graded in front of you**, with battery report and stress test shown\n- It carries a **real warranty** — store or remaining brand warranty, in writing\n- SSD is fresh, battery health is disclosed, and BIOS password is cleared\n\n### When refurbished wins\n\n- Business laptops (Latitude, EliteBook, ThinkPad) built for 5+ years of use\n- Your budget is under ₹45,000 and you need 16GB RAM + good keyboard\n- You don't need a thin-and-light or a touchscreen\n\n### When to buy new\n\n- Gaming laptops — heat cycles matter and warranty terms differ\n- You want the latest processor generation for heavy creative work\n\nEvery refurbished unit we sell is graded A/A+ and comes with a 6-month in-store warranty. Ask to see the tests before you pay.",
      10, true, ["refurbished", "buying-guide"]
    ),
    article(
      "Gaming laptop buying checklist (1080p focus)",
      "gaming-laptop-checklist", "Gaming", px(6053283),
      "Panel refresh rate, thermals, and what RTX 3050 actually handles — a no-nonsense checklist from our counter.",
      "Gaming laptops have the worst value-for-rupee in the category, so spend deliberately.\n\n### The shortlist\n\n- **144Hz panel minimum** — it's the difference everyone notices\n- **RTX 3050 handles 1080p High** on most AAA titles; 3060 handles it at Epic\n- **16GB RAM is standard now** — don't buy 8GB in a gaming machine\n- **Check the thermals in person** — run a stress test in the store if you can\n\n### What we'd avoid\n\n- 60Hz panels in a machine with a dedicated GPU\n- Faintly specced 'gaming' clones with no after-sales support\n\nAll our gaming stock runs a store stress test before you buy, and the 2-year on-site warranty is in the bill.",
      14, false, ["gaming", "checklist"]
    ),
    article(
      "5 ways to make your laptop last 4 years",
      "make-laptop-last-4-years", "Tips", px(12882907),
      "Battery care, SSD headroom, and the ₹2,000 upgrade that doubles a machine's life.",
      "Most laptops don't die — they just slow down. Here's the care routine we tell every customer.\n\n### Battery\n\n- Don't keep it at 100% on AC all the time — 40–80% is the sweet spot\n- A laptop left at 0% for months can permanently lose battery health\n\n### Storage & speed\n\n- Keep 15% of your SSD free — a full SSD is a slow SSD\n- One upgrade pays off most: **swap to a bigger SSD or add RAM** (₹1,500–3,500 at our counter, done in an hour)\n\n### Physical\n\n- Never block the vents with bed covers or sofas\n- A full service once a year (cleaning + thermal paste) keeps gaming laptops quiet\n\nOur service desk does all of the above, and customers who bought here get priority slots.",
      18, false, ["tips", "maintenance"]
    ),
  ]);

  /* ---------- offers ---------- */
  const catRefurb = cid("Refurbished");
  const inDays = (n: number) => new Date(now.getTime() + n * 864e5);
  await db.insert(S.offers).values([
    { name: "Student Exchange Season", badge: "EXCHANGE", description: "Bring your old laptop — honest on-the-spot exchange quote, no online mystery pricing.", appliesTo: "all", active: true, endDate: inDays(20) },
    { name: "Refurbished Ref Days", badge: "REFURB", description: "Quality-checked business laptops from ₹32,990 with 6-month store warranty.", appliesTo: "category", targetId: catRefurb, active: true, endDate: inDays(10) },
    { name: "Monsoon Bank EMI Offers", badge: "EMI", description: "No-cost EMI with partner banks on laptops above ₹40,000. Ask at the counter.", appliesTo: "all", active: true, endDate: inDays(14) },
  ]);

  /* ---------- coupons ---------- */
  await db.insert(S.coupons).values([
    { code: "KARNI5", type: "percent", value: 5, minOrder: 20000, maxDiscount: 3000, usageLimit: 0, active: true, expiresAt: inDays(30) },
    { code: "JODHPUR200", type: "flat", value: 200, minOrder: 10000, maxDiscount: 0, usageLimit: 100, usedCount: 3, active: true, expiresAt: inDays(15) },
  ]);

  /* ---------- media ---------- */
  await db.insert(S.media).values([
    { name: "dell-inspiron-main.jpg", url: px(8533387) },
    { name: "macbook-air-main.jpg", url: px(249535) },
    { name: "tuf-gaming-main.jpg", url: px(6053283) },
    { name: "store-interior.jpg", url: px(17565491) },
    { name: "refurb-latitude.jpg", url: px(8534153) },
  ]);

  /* ---------- settings that depend on seeded ids ---------- */
  await db.insert(S.settings).values([
    { key: "hero", value: { productId: pid("apple-macbook-air-13-m1"), bottomPrice: 32990 } },
    { key: "spotlight", value: { productId: pid("apple-macbook-air-13-m1"), endAt: inDays(1).toISOString(), startAt: inDays(-1).toISOString() } },
  ]);

  /* ---------- activity ---------- */
  await db.insert(S.activityLog).values({
    adminName: "system", action: "create", entity: "seed", entityId: "1",
    summary: "Initial catalogue seeded: 12 products, 6 brands, 5 categories, orders, enquiries, videos, blog, offers, coupons.",
  });

  console.log("Seed complete ✓");
  console.log("Admin logins:");
  console.log("  Super Admin → admin@maakarni.com / MaaKarni@123");
  console.log("  Admin       → manager@maakarni.com / Manager@123");
  console.log("  Staff       → staff@maakarni.com / Staff@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
