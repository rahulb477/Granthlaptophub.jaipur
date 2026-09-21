const fs = require("fs");
const chunk = fs.readFileSync("/tmp/firebase_service_chunk.js", "utf-8");

// Look for functions and collection calls
console.log("=== CHUNK EXCERPTS ===");
const lines = chunk.split(/(async function [a-zA-Z0-9_$]+|function [a-zA-Z0-9_$]+)/);
for (let i = 1; i < lines.length; i += 2) {
  const fnHeader = lines[i];
  const fnBody = lines[i + 1] ? lines[i + 1].slice(0, 400) : "";
  console.log("-----------------------------------------");
  console.log(fnHeader);
  console.log(fnBody);
}
