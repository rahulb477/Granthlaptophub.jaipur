const https = require("https");
const fs = require("fs");

https.get("https://laptop-web-iota.vercel.app/", (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    fs.writeFileSync("/tmp/customer_site.html", data);
    console.log("Saved customer site HTML, length:", data.length);
  });
});
