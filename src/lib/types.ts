import type { adminUsers } from "@/db/schema";

export type AdminUser = typeof adminUsers.$inferSelect;
