// pure-node-server.js - Using only built-in Node.js modules
console.log('🚀 Starting PURE NODE.js server (no external dependencies)...');

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

console.log('Environment check:');
console.log('- Node version:', process.version);
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- Working directory:', process.cwd());

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

// Simple HTTP server using only built-in modules
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log('Request:', req.method, pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname === '/' || pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Pure Node.js server running',
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform
      }));
    } 
    else if (pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pure Node.js Server</title>
        </head>
        <body>
          <h1>Pure Node.js Server Running</h1>
          <p>This server uses ONLY built-in Node.js modules</p>
          <p>Time: ${new Date().toISOString()}</p>
          <p>Node version: ${process.version}</p>
          <p>Uptime: ${process.uptime().toFixed(1)}s</p>
          <p>Platform: ${process.platform}</p>
          <h2>Test Results:</h2>
          <ul>
            <li>✅ HTTP server working</li>
            <li>✅ Port binding successful</li>
            <li>✅ Request handling working</li>
            <li>✅ No dependency issues</li>
          </ul>
        </body>
        </html>
      `);
    }
    else if (pathname.startsWith('/api/test')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        test: 'api-working',
        path: pathname,
        method: req.method,
        timestamp: new Date().toISOString()
      }));
    }
    else {
      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not found',
        path: pathname,
        available: ['/', '/health', '/admin', '/api/test']
      }));
    }
  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }));
  }
});

server.on('error', (error) => {
  console.error('SERVER ERROR:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ PURE NODE.JS SERVER STARTED SUCCESSFULLY');
  console.log(`✅ Listening on 0.0.0.0:${PORT}`);
  console.log('✅ No external dependencies - using only built-in Node.js modules');
});

// Keep alive heartbeat
setInterval(() => {
  console.log(`💓 Server heartbeat - uptime: ${process.uptime().toFixed(1)}s`);
}, 30000);