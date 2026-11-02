#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must point to the worker metadata directory}"
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT > 0 && PORT < 65536 )) || { echo "PORT must be an integer from 1 to 65535." >&2; exit 1; }

cd "$PROJECT_DIR"
/usr/bin/time -p mkdir -p "$BUILD_DIR" "$OPENCODE_WEB_DIR"
# This project is a standalone HTML app with no package manifest or local dependencies.
/usr/bin/time -p cp -p "$PROJECT_DIR/index.html" "$BUILD_DIR/index.html"
/usr/bin/time -p node - "$PROJECT_DIR" "$BUILD_DIR" "$OPENCODE_WEB_DIR/deployment-output.json" <<'NODE'
const fs = require('node:fs')
const [project, directory, metadata] = process.argv.slice(2)
fs.writeFileSync(metadata, JSON.stringify({ project, directory }))
NODE

# Serve the built static directory in this foreground process for the controller.
/usr/bin/time -p node - "$BUILD_DIR" "$PORT" <<'NODE'
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(process.argv[2])
const port = Number(process.argv[3])
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' }
const server = http.createServer((request, response) => {
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) }
  catch { response.writeHead(400).end('Bad request'); return }
  if (pathname === '/') pathname = '/index.html'
  const file = path.resolve(root, `.${pathname}`)
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
  fs.stat(file, (statError, stat) => {
    const target = !statError && stat.isDirectory() ? path.join(file, 'index.html') : file
    fs.readFile(target, (error, contents) => {
      if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found'); return }
      response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': contents.length, 'Cache-Control': 'no-cache' })
      response.end(request.method === 'HEAD' ? undefined : contents)
    })
  })
})
server.listen(port, '0.0.0.0', () => console.log(`Serving ${root} on port ${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
NODE
