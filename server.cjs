const http = require("node:http");

const port = Number(process.env.PORT || 5000);
const server = http.createServer((request, response) => {
  const healthy = request.method === "GET" && request.url === "/health";
  response.writeHead(healthy ? 200 : 410, { "Content-Type": "application/json" });
  response.end(JSON.stringify(healthy
    ? { status: "ok", payments: "edge-functions" }
    : { error: "This local proxy has been retired. CollectiPay payments use authenticated Supabase Edge Functions." }));
});
server.listen(port, "127.0.0.1", () => {
  console.log("Local health endpoint listening on port " + port);
});
