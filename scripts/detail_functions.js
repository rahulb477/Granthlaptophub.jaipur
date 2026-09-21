const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

// Print function zg (product mapping)
const idxZg = html.indexOf("function zg(");
console.log("=== zg function ===");
console.log(html.slice(idxZg, idxZg + 1200));

// Print function oI (blog mapping)
const idxOI = html.indexOf("function oI(");
console.log("\n=== oI function ===");
console.log(html.slice(idxOI, idxOI + 600));

// Print function mI (order placement)
const idxMI = html.indexOf("function mI(");
console.log("\n=== mI function ===");
console.log(html.slice(idxMI, idxMI + 1200));

// Print function xI (coupon validation)
const idxXI = html.indexOf("function xI(");
console.log("\n=== xI function ===");
console.log(html.slice(idxXI, idxXI + 800));
