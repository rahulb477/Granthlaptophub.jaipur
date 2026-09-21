const fs = require("fs");
const html = fs.readFileSync("/tmp/customer_site.html", "utf-8");

// Print characters 555000 to 570000 where all the firebase / firestore service functions are located
const chunk = html.slice(558000, 568000);
fs.writeFileSync("/tmp/firebase_service_chunk.js", chunk);
console.log("Wrote chunk of length", chunk.length);
