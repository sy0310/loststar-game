/* Static development preview with same-origin MP3 byte ranges for Safari. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const root = fs.realpathSync(path.resolve(option("--root", __dirname)));
const legacyPath = option("--legacy-root", null);
const legacyRoot = legacyPath
  ? fs.realpathSync(path.resolve(legacyPath))
  : null;
const port = Number(option("--port", "4397"));
const host = option("--host", "127.0.0.1");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".wav": "audio/wav",
};
const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  let file;
  try {
    let pathname = decodeURIComponent(
      new URL(request.url, "http://preview.invalid").pathname,
    );
    if (
      legacyRoot &&
      /^\/loststar-salvage\/(?:[a-f0-9]{7}\/)?(?:index.html)?$/.test(pathname)
    ) {
      response.writeHead(302, { Location: "/", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const legacy = legacyRoot && pathname.startsWith("/legacy-v051/");
    const base = legacy ? legacyRoot : root;
    if (legacy) pathname = pathname.slice("/legacy-v051".length);
    file = path.resolve(base, "." + pathname);
    if (!file.startsWith(base + path.sep) && file !== base) throw Error("path");
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    file = fs.realpathSync(file);
    if (!file.startsWith(base + path.sep) || !fs.statSync(file).isFile())
      throw Error("path");
  } catch {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const size = fs.statSync(file).size;
  let start = 0,
    end = size - 1,
    status = 200;
  const headers = {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (match && (match[1] || match[2])) {
      start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2]));
      end =
        match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    } else {
      start = -1;
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      response.writeHead(416, { "Content-Range": `bytes */${size}` });
      response.end();
      return;
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = end - start + 1;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || size === 0) {
    response.end();
    return;
  }
  const stream = fs.createReadStream(file, { start, end });
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
});
server.listen(port, host, () =>
  console.log(
    `Static survivor preview http://${host}:${server.address().port}/`,
  ),
);
