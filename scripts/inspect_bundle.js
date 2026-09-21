const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

// Search for collection strings
const colRegex = /\b(?:collection|doc)\s*\([^,]+,\s*["'`]([a-zA-Z0-9_\/-]+)["'`]/g;
const paths = new Set();
let m;
while ((m = colRegex.exec(html)) !== null) {
  paths.add(m[1]);
}
console.log("Firestore collection / doc paths:", Array.from(paths));

// Look for collection names mentioned in strings
const words = ["products", "categories", "brands", "blogPosts", "videos", "offers", "reviews", "coupons", "siteSettings", "homepage", "users", "orders", "enquiries", "rewards", "addresses"];
for (const w of words) {
  const count = (html.match(new RegExp(`["'\`]${w}["'\`]`, "g")) || []).length;
  console.log(`String "${w}": ${count} occurrences`);
}

// Search for document/collection structures
const snippets = [];
const snippetRegex = /["'`](products|categories|brands|blogPosts|videos|offers|reviews|coupons|siteSettings|homepage|users)["'`]/g;
let sm;
let indices = [];
while ((sm = snippetRegex.exec(html)) !== null) {
  indices.push(sm.index);
}
console.log("Found", indices.length, "matching keyword positions");
for (const idx of indices.slice(0, 15)) {
  console.log("--- SNIPPET @", idx, "---");
  console.log(html.slice(Math.max(0, idx - 100), Math.min(html.length, idx + 200)));
}
