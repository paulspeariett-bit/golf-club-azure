// Ultra-basic Node.js HTTP server - no external dependencies
// Updated: September 19, 2025 - Fixed login compatibility and GitHub Actions deployment
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
            user: {
              username: 'admin',
              role: 'system_admin',
              name: 'System Administrator'
            },
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

  // Admin API endpoints
  if (pathname.startsWith('/admin/')) {
    // Mock data for demonstration
    const mockOrganizations = [
      { id: 1, name: 'Golf Club Demo', slug: 'golf-club-demo', email: 'admin@golfclub.com', phone: '555-0123', description: 'Demo golf club organization', createdAt: '2025-09-19T08:00:00Z' }
    ];
    
    const mockSites = [
      { id: 1, name: 'Golf Club & Venues', organizationId: 1, status: 'active', url: 'https://golf-club-fresh.azurewebsites.net', createdAt: '2025-09-19T08:00:00Z' }
    ];

    const mockUsers = [
      { id: 1, username: 'admin', email: 'admin@golfclub.com', role: 'system_admin', status: 'active', createdAt: '2025-09-19T08:00:00Z' }
    ];

    // GET /admin/organizations
    if (pathname === '/admin/organizations' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: mockOrganizations }));
      return;
    }

    // POST /admin/organizations
    if (pathname === '/admin/organizations' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const orgData = JSON.parse(body);
          const newOrg = {
            id: mockOrganizations.length + 1,
            name: orgData.name,
            slug: orgData.slug,
            email: orgData.email,
            phone: orgData.phone,
            description: orgData.description,
            createdAt: new Date().toISOString()
          };
          mockOrganizations.push(newOrg);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: newOrg }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // GET /admin/sites
    if (pathname === '/admin/sites' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: mockSites }));
      return;
    }

    // POST /admin/sites
    if (pathname === '/admin/sites' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const siteData = JSON.parse(body);
          const newSite = {
            id: mockSites.length + 1,
            name: siteData.name,
            organizationId: siteData.organizationId,
            status: 'active',
            url: siteData.url || 'https://example.com',
            createdAt: new Date().toISOString()
          };
          mockSites.push(newSite);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: newSite }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // GET /admin/stats
    if (pathname === '/admin/stats' && req.method === 'GET') {
      const stats = {
        totalOrganizations: mockOrganizations.length,
        activeSites: mockSites.filter(s => s.status === 'active').length,
        totalUsers: mockUsers.length,
        systemStatus: 'online'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: stats }));
      return;
    }

    // GET /admin/users
    if (pathname === '/admin/users' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: mockUsers }));
      return;
    }

    // GET /admin/logs
    if (pathname === '/admin/logs' && req.method === 'GET') {
      const logs = [
        { timestamp: new Date().toISOString(), event: 'System initialized', site: 'ClubVision Platform', user: 'System' }
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: logs }));
      return;
    }

    // Default 404 for unknown admin endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Admin endpoint not found' }));
    return;
  }
  
  // Simple admin test page
  if (pathname === '/test' || pathname === '/simple-admin') {
    const testPath = path.join(__dirname, 'simple-admin.html');
    
    fs.readFile(testPath, (err, data) => {
      if (err) {
        console.error('Error reading simple-admin.html:', err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('simple-admin.html not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
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

