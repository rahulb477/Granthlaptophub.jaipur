const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

// Search for any other collection names in the client code
// In firestore minified bundle, collection(db, "...") is often qs(Ne, "...") or mn(Ne, "...") or similar
const re = /\b(?:qs|mn|collection|doc)\s*\(\s*(?:Ne|db|[a-zA-Z0-9_$]+)\s*,\s*["'`]([a-zA-Z0-9_\/-]+)["'`]/g;
const paths = new Set();
let m;
while ((m = re.exec(html)) !== null) {
  paths.add(m[1]);
}
console.log("Matched paths:", Array.from(paths));

// Let's also look for any string literals matching collection-like names in the entire script
const candidates = ["products", "categories", "brands", "blogPosts", "videos", "offers", "reviews", "coupons", "siteSettings", "homepage", "settings", "users", "orders", "enquiries", "rewards", "addresses", "banners", "testimonials"];
for (const c of candidates) {
  const matches = [...html.matchAll(new RegExp(`["'\`](${c})["'\`]`, "g"))];
  console.log(`Candidate "${c}": found ${matches.length} matches`);
}
