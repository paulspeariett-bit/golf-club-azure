// Ultra-basic Node.js HTTP server - no external dependencies
console.log('🚀 Starting ultra-basic Node.js HTTP server...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('PORT:', process.env.PORT || '8080');

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (pathname === '/health' || pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      node: process.version,
      port: PORT
    }));
    return;
  }
  
  // Root endpoint
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Ultra-Basic Node.js Server with Login',
      status: 'running',
      timestamp: new Date().toISOString(),
      node: process.version
    }));
    return;
  }
  

  // Login endpoint
  if (pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        
        // Simple admin/admin authentication
        if (username === 'admin' && password === 'admin') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            token: 'admin-token-' + Date.now(),
            message: 'Login successful'
          }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON'
        }));
      }
    });
    return;
  }
  // Admin HTML file
  if (pathname === '/admin' || pathname === '/admin.html') {
    const adminPath = path.join(__dirname, 'public', 'admin.html');
    
    fs.readFile(adminPath, (err, data) => {
      if (err) {
        console.error('Error reading admin.html:', err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('admin.html not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Health endpoints: /health, /healthz`);
  console.log(`✅ Admin: /admin`);
  console.log(`✅ Server is ready to accept connections`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error.message);
  console.error('❌ Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('❌ Reason:', reason);
  process.exit(1);
});

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('📥 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

console.log('🎯 Ultra-basic server setup complete');
