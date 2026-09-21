const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

for (const name of ["Mp", "Vp", "_l", "fs", "pr"]) {
  const idx = html.indexOf(name + "=");
  if (idx !== -1) {
    console.log(`=== ${name}= @ ${idx} ===\n`, html.slice(idx, idx + 400));
  }
}
