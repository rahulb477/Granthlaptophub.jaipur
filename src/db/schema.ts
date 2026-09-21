import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

/* ---------- shared jsonb shapes ---------- */
export interface VariantOption {
  label: string;
  delta: number;
  available: boolean;
  isDefault: boolean;
}
export interface VariantDim {
  key: string;
  name: string;
  options: VariantOption[];
}
export interface SpecRow {
  label: string;
  value: string;
}

/* ---------- admin users ---------- */
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------- brands / categories ---------- */
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  logo: varchar("logo", { length: 500 }).default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description").default(""),
  image: varchar("image", { length: 500 }).default(""),
  icon: varchar("icon", { length: 40 }).default("laptop"),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------- products ---------- */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  brandId: integer("brand_id"),
  categoryId: integer("category_id"),
  sku: varchar("sku", { length: 80 }).default(""),
  condition: varchar("condition", { length: 30 }).notNull().default("new"),
  status: varchar("status", { length: 20 }).notNull().default("published"),
  stockQty: integer("stock_qty").notNull().default(0),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  description: text("description").default(""),
  about: text("about").default(""),
  screen: varchar("screen", { length: 60 }).default(""),
  processor: varchar("processor", { length: 120 }).default(""),
  generation: varchar("generation", { length: 40 }).default(""),
  ram: varchar("ram", { length: 40 }).default(""),
  storage: varchar("storage", { length: 60 }).default(""),
  graphics: varchar("graphics", { length: 120 }).default(""),
  os: varchar("os", { length: 60 }).default(""),
  touch: boolean("touch").notNull().default(false),
  battery: varchar("battery", { length: 80 }).default(""),
  ports: text("ports").default(""),
  weight: varchar("weight", { length: 40 }).default(""),
  customSpecs: jsonb("custom_specs").$type<SpecRow[]>().notNull().default([]),
  price: integer("price").notNull().default(0),
  mrp: integer("mrp"),
  emiMonthly: integer("emi_monthly"),
  warranty: varchar("warranty", { length: 120 }).default(""),
  warrantyDesc: text("warranty_desc").default(""),
  returnEligible: boolean("return_eligible").notNull().default(true),
  returnPeriod: varchar("return_period", { length: 80 }).default(""),
  returnDesc: text("return_desc").default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  variants: jsonb("variants").$type<VariantDim[]>().notNull().default([]),
  seoTitle: varchar("seo_title", { length: 200 }).default(""),
  seoDesc: varchar("seo_desc", { length: 300 }).default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ---------- customers / orders / enquiries ---------- */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).default(""),
  city: varchar("city", { length: 80 }).default("Jodhpur"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("order_no", { length: 30 }).notNull().unique(),
  customerId: integer("customer_id"),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).default(""),
  phone: varchar("phone", { length: 20 }).default(""),
  address: text("address").default(""),
  note: text("note").default(""),
  items: jsonb("items")
    .$type<
      {
        productId: number;
        name: string;
        image: string;
        variant: Record<string, string>;
        qty: number;
        unitPrice: number;
      }[]
    >()
    .notNull()
    .default([]),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  couponCode: varchar("coupon_code", { length: 40 }).default(""),
  total: integer("total").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("cod"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const enquiries = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }).default(""),
  email: varchar("email", { length: 160 }).default(""),
  productId: integer("product_id"),
  productName: varchar("product_name", { length: 200 }).default(""),
  message: text("message").default(""),
  source: varchar("source", { length: 30 }).notNull().default("website"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------- content ---------- */
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").default(""),
  youtubeUrl: varchar("youtube_url", { length: 500 }).notNull().default(""),
  thumbnail: varchar("thumbnail", { length: 500 }).default(""),
  category: varchar("category", { length: 80 }).default("Reviews"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  category: varchar("category", { length: 80 }).default("Guides"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  image: varchar("image", { length: 500 }).default(""),
  excerpt: text("excerpt").default(""),
  content: text("content").default(""),
  author: varchar("author", { length: 100 }).default("Maa Karni Team"),
  publishDate: timestamp("publish_date").notNull().defaultNow(),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: varchar("seo_title", { length: 200 }).default(""),
  seoDesc: varchar("seo_desc", { length: 300 }).default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  badge: varchar("badge", { length: 60 }).default(""),
  description: text("description").default(""),
  appliesTo: varchar("applies_to", { length: 20 }).notNull().default("all"),
  targetId: integer("target_id"),
  banner: varchar("banner", { length: 500 }).default(""),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  type: varchar("type", { length: 10 }).notNull().default("percent"),
  value: integer("value").notNull().default(0),
  minOrder: integer("min_order").notNull().default(0),
  maxDiscount: integer("max_discount").notNull().default(0),
  startAt: timestamp("start_at"),
  expiresAt: timestamp("expires_at"),
  usageLimit: integer("usage_limit").notNull().default(0),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  rating: integer("rating").notNull().default(5),
  text: text("text").default(""),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  url: varchar("url", { length: 600 }).notNull(),
  kind: varchar("kind", { length: 20 }).notNull().default("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------- site settings (json documents, edited from the admin panel) ---------- */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ---------- activity log ---------- */
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id"),
  adminName: varchar("admin_name", { length: 120 }).notNull().default("system"),
  action: varchar("action", { length: 30 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 60 }).default(""),
  summary: text("summary").default(""),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
