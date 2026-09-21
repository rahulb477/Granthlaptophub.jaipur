const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

// Look for Mp (bestSellers fallback), Vp (trending fallback), _l (spotlight fallback), fs (products fallback), pr (blog fallback)
function printVar(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(\\[|\\{)`);
  const match = html.match(re);
  if (match) {
    const start = match.index;
    console.log(`=== ${name} ===\n`, html.slice(start, start + 600));
  } else {
    console.log(`=== ${name} not found with const`);
  }
}

printVar("Mp");
printVar("Vp");
printVar("_l");
printVar("fs");
printVar("pr");
