const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = 8000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "data.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

http.createServer(handleRequest).listen(PORT, HOST, function () {
  console.log("Wacker Cup läuft auf http://" + HOST + ":" + PORT);
});

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://" + request.headers.host);

  if (url.pathname === "/api/data") {
    return handleDataApi(request, response);
  }

  return serveStatic(url.pathname, response);
}

async function handleDataApi(request, response) {
  if (request.method === "GET") {
    try {
      const raw = await fs.promises.readFile(DATA_FILE, "utf8");
      return send(response, 200, raw, "application/json; charset=utf-8");
    } catch (error) {
      return sendJson(response, 500, { error: "data_read_failed", message: error.message });
    }
  }

  if (request.method === "POST") {
    try {
      const rawBody = await readBody(request);
      const parsed = JSON.parse(rawBody);
      await fs.promises.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2) + "\n", "utf8");
      return sendJson(response, 200, { ok: true });
    } catch (error) {
      return sendJson(response, 400, { error: "data_write_failed", message: error.message });
    }
  }

  return sendJson(response, 405, { error: "method_not_allowed" });
}

async function serveStatic(urlPath, response) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, normalizedPath));

  if (!filePath.startsWith(ROOT)) {
    return send(response, 403, "Forbidden", "text/plain; charset=utf-8");
  }

  try {
    const stats = await fs.promises.stat(filePath);
    const targetPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(targetPath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const raw = await fs.promises.readFile(targetPath);
    return send(response, 200, raw, mime);
  } catch (_error) {
    return send(response, 404, "Not Found", "text/plain; charset=utf-8");
  }
}

function readBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", function (chunk) {
      body += chunk;
    });
    request.on("end", function () {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}
