const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 8000)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

function resolvePath(urlPath) {
  let requestPath = decodeURIComponent((urlPath || '/').split('?')[0])
  if (requestPath === '/') requestPath = '/viewer/index.html'

  const absolute = path.resolve(ROOT, `.${requestPath}`)
  if (!absolute.startsWith(ROOT)) return null
  return absolute
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url)
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`Viewer su http://localhost:${PORT}/viewer/index.html`)
})
