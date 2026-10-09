const http = require('http');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 5000);
const apiHost = process.env.API_HOST || '127.0.0.1';
const apiPort = Number(process.env.API_PORT || 3001);
const distDir = path.join(__dirname, 'dist');
const compressionMiddleware = compression({ threshold: 1024 });
const apiAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100,
  maxFreeSockets: 10,
});

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function decodeRequestPath(rawUrl) {
  try {
    return decodeURIComponent(String(rawUrl || '/').split('?')[0]);
  } catch (_) {
    return null;
  }
}

function sendFile(req, res, filePath, options = {}) {
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Could not read file.');
      return;
    }

    const type = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    const requestPath = decodeRequestPath(req.url) || '/';
    const isHashedAsset = requestPath.startsWith('/assets/')
      && /-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(path.basename(requestPath));
    const noStore = Boolean(options.noStore || ext === '.html' || requestPath === '/sw.js');
    const cacheControl = noStore
      ? 'no-store, no-cache, must-revalidate, proxy-revalidate'
      : isHashedAsset
        ? 'public, max-age=31536000, immutable'
        : 'no-cache, must-revalidate';
    const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
    if (!noStore && req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      ETag: etag,
      'Cache-Control': cacheControl,
      ...(ext === '.html' ? { Pragma: 'no-cache', Expires: '0' } : {}),
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

function findReplacementAsset(urlPath) {
  if (!urlPath.startsWith('/assets/')) return null;
  const assetName = path.basename(urlPath);
  const ext = path.extname(assetName);
  const stem = assetName.slice(0, -ext.length);
  const hashSep = stem.lastIndexOf('-');
  if (hashSep <= 0 || !['.js', '.css'].includes(ext)) return null;

  const prefix = stem.slice(0, hashSep + 1);
  const assetsDir = path.join(distDir, 'assets');
  try {
    const matches = fs.readdirSync(assetsDir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(ext));
    if (matches.length === 1) return path.join(assetsDir, matches[0]);
  } catch (_) {
    return null;
  }
  return null;
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  compressionMiddleware(req, res, () => {
  const rawUrl = req.url || '/';

  if (rawUrl.startsWith('/api/')) {
    const proxyReq = http.request(
      {
        host: apiHost,
        port: apiPort,
        method: req.method,
        path: rawUrl,
        agent: apiAgent,
        headers: {
          ...req.headers,
          host: `${apiHost}:${apiPort}`,
          'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', '),
          'x-forwarded-host': req.headers.host || '',
          'x-forwarded-proto': 'http',
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: 'Backend is not reachable' }));
    });
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy(new Error('Backend request timed out'));
    });

    req.pipe(proxyReq);
    return;
  }

  const urlPath = decodeRequestPath(rawUrl);
  if (urlPath === null) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = path.join(distDir, safePath);

  if (!requestedPath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(req, res, requestedPath);
      return;
    }

    const replacementAsset = findReplacementAsset(urlPath);
    if (replacementAsset) {
      sendFile(req, res, replacementAsset, { noStore: true });
      return;
    }

    if (urlPath.startsWith('/assets/')) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end('Asset not found. Refresh the page.');
      return;
    }

    sendFile(req, res, path.join(distDir, 'index.html'));
  });
  });
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

server.listen(port, host, () => {
  console.log(`Frontend is running on http://${host}:${port}`);
});
