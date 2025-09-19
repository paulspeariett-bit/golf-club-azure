// Ultra-basic Node.js HTTP server - no external dependencies
// Updated: September 19, 2025 - Fixed login compatibility and GitHub Actions deployment
// File-based persistence implemented for organizations, sites, and users
console.log('🚀 Starting ultra-basic Node.js HTTP server...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('PORT:', process.env.PORT || '8080');

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

// File-based data persistence
const DATA_DIR = path.join(__dirname, 'data');
const ORGANIZATIONS_FILE = path.join(DATA_DIR, 'organizations.json');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCREENS_FILE = path.join(DATA_DIR, 'screens.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions for data persistence
function loadJsonFile(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
  }
  return defaultData;
}

function saveJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
    return false;
  }
}

// Initialize data files with default data if they don't exist
function initializeDataFiles() {
  const defaultOrganizations = [
    { id: 1, name: 'Golf Club Demo', slug: 'golf-club-demo', email: 'admin@golfclub.com', phone: '555-0123', description: 'Demo golf club organization', createdAt: '2025-09-19T08:00:00Z' }
  ];
  
  const defaultSites = [
    { 
      id: 1, 
      name: 'Golf Club & Venues', 
      organizationId: 1, 
      status: 'active', 
      url: 'https://golf-club-fresh.azurewebsites.net', 
      createdAt: '2025-09-19T08:00:00Z' 
    },
    {
      id: 2,
      name: 'Pro Shop',
      organizationId: 1,
      status: 'active',
      url: 'https://golf-club-fresh.azurewebsites.net/proshop',
      createdAt: '2025-09-19T08:00:00Z'
    },
    {
      id: 3,
      name: 'Restaurant & Bar',
      organizationId: 1,
      status: 'active',
      url: 'https://golf-club-fresh.azurewebsites.net/restaurant',
      createdAt: '2025-09-19T08:00:00Z'
    }
  ];
  
  const defaultUsers = [
    { 
      id: 1, 
      username: 'admin', 
      email: 'admin@golfclub.com', 
      role: 'system_admin', 
      status: 'active', 
      organizationId: null, // system admin can access all organizations
      siteIds: [], // system admin can access all sites
      createdAt: '2025-09-19T08:00:00Z' 
    },
    {
      id: 2,
      username: 'org_admin',
      email: 'orgadmin@golfclub.com',
      role: 'org_admin',
      status: 'active',
      organizationId: 1, // can access all sites in organization 1
      siteIds: [], // empty means all sites in the organization
      createdAt: '2025-09-19T08:00:00Z'
    },
    {
      id: 3,
      username: 'site_admin',
      email: 'siteadmin@golfclub.com',
      role: 'site_admin',
      status: 'active',
      organizationId: 1,
      siteIds: [1], // can only access site 1
      createdAt: '2025-09-19T08:00:00Z'
    }
  ];
  
  if (!fs.existsSync(ORGANIZATIONS_FILE)) {
    saveJsonFile(ORGANIZATIONS_FILE, defaultOrganizations);
  }
  if (!fs.existsSync(SITES_FILE)) {
    saveJsonFile(SITES_FILE, defaultSites);
  }
  if (!fs.existsSync(USERS_FILE)) {
    saveJsonFile(USERS_FILE, defaultUsers);
  }
}

// Helper function to get user's accessible sites
function getUserAccessibleSites(user, allSites) {
  if (user.role === 'system_admin') {
    // System admin can access all sites
    return allSites;
  } else if (user.role === 'org_admin') {
    // Organization admin can access all sites in their organization
    return allSites.filter(site => site.organizationId === user.organizationId);
  } else if (user.role === 'site_admin' || user.role === 'content_manager') {
    // Site admin/content manager can only access their assigned sites
    return allSites.filter(site => 
      user.siteIds.includes(site.id) && site.organizationId === user.organizationId
    );
  }
  return [];
}

// Helper function to authenticate user
function authenticateUser(username, password) {
  const users = loadJsonFile(USERS_FILE, []);
  return users.find(user => 
    user.username === username && 
    user.status === 'active' &&
    (password === 'admin' || password === user.password) // Simple password check for demo
  );
}

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

  // Force refresh data files endpoint (for development)
  if (pathname === '/refresh-data' && req.method === 'POST') {
    console.log('🔄 Force refreshing data files...');
    
    const defaultSites = [
      { 
        id: 1, 
        name: 'Golf Club & Venues', 
        organizationId: 1, 
        status: 'active', 
        url: 'https://golf-club-fresh.azurewebsites.net', 
        createdAt: '2025-09-19T08:00:00Z' 
      },
      {
        id: 2,
        name: 'Pro Shop',
        organizationId: 1,
        status: 'active',
        url: 'https://golf-club-fresh.azurewebsites.net/proshop',
        createdAt: '2025-09-19T08:00:00Z'
      },
      {
        id: 3,
        name: 'Restaurant & Bar',
        organizationId: 1,
        status: 'active',
        url: 'https://golf-club-fresh.azurewebsites.net/restaurant',
        createdAt: '2025-09-19T08:00:00Z'
      }
    ];

    const defaultUsers = [
      { 
        id: 1, 
        username: 'admin', 
        email: 'admin@golfclub.com', 
        role: 'system_admin', 
        status: 'active', 
        organizationId: null,
        siteIds: [],
        createdAt: '2025-09-19T08:00:00Z' 
      },
      {
        id: 2,
        username: 'org_admin',
        email: 'orgadmin@golfclub.com',
        role: 'org_admin',
        status: 'active',
        organizationId: 1,
        siteIds: [],
        createdAt: '2025-09-19T08:00:00Z'
      },
      {
        id: 3,
        username: 'site_admin',
        email: 'siteadmin@golfclub.com',
        role: 'site_admin',
        status: 'active',
        organizationId: 1,
        siteIds: [1],
        createdAt: '2025-09-19T08:00:00Z'
      }
    ];

    // Force update files
    saveJsonFile(SITES_FILE, defaultSites);
    saveJsonFile(USERS_FILE, defaultUsers);
    
    console.log('✅ Data files refreshed successfully');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Data files refreshed',
      sites: defaultSites.length,
      users: defaultUsers.length
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
    // GET /admin/organizations
    if (pathname === '/admin/organizations' && req.method === 'GET') {
      const organizations = loadJsonFile(ORGANIZATIONS_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: organizations }));
      return;
    }

    // POST /admin/organizations
    if (pathname === '/admin/organizations' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const organizations = loadJsonFile(ORGANIZATIONS_FILE, []);
          const orgData = JSON.parse(body);
          const newOrg = {
            id: Math.max(0, ...organizations.map(o => o.id)) + 1,
            name: orgData.name,
            slug: orgData.slug,
            email: orgData.email,
            phone: orgData.phone,
            description: orgData.description,
            createdAt: new Date().toISOString()
          };
          organizations.push(newOrg);
          saveJsonFile(ORGANIZATIONS_FILE, organizations);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: newOrg }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // GET /admin/sites (also used by CMS)
    if (pathname === '/admin/sites' && req.method === 'GET') {
      const sites = loadJsonFile(SITES_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: sites }));
      return;
    }

    // POST /admin/sites
    if (pathname === '/admin/sites' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const sites = loadJsonFile(SITES_FILE, []);
          const siteData = JSON.parse(body);
          const newSite = {
            id: Math.max(0, ...sites.map(s => s.id)) + 1,
            name: siteData.name,
            organizationId: siteData.organizationId,
            status: 'active',
            url: siteData.url || 'https://example.com',
            createdAt: new Date().toISOString()
          };
          sites.push(newSite);
          saveJsonFile(SITES_FILE, sites);
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
      const organizations = loadJsonFile(ORGANIZATIONS_FILE, []);
      const sites = loadJsonFile(SITES_FILE, []);
      const users = loadJsonFile(USERS_FILE, []);
      const stats = {
        totalOrganizations: organizations.length,
        activeSites: sites.filter(s => s.status === 'active').length,
        totalUsers: users.length,
        systemStatus: 'online'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: stats }));
      return;
    }

    // GET /admin/users
    if (pathname === '/admin/users' && req.method === 'GET') {
      const users = loadJsonFile(USERS_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: users }));
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

  // Screen pairing endpoints
  if (pathname.startsWith('/screens/')) {
    // GET /screens/list - List all screens (for admin)
    if (pathname === '/screens/list' && req.method === 'GET') {
      const screens = loadJsonFile(SCREENS_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: screens }));
      return;
    }

    // DELETE /screens/delete/:code - Delete a screen (for admin)
    if (pathname.startsWith('/screens/delete/') && req.method === 'DELETE') {
      const pairingCode = pathname.split('/')[3];
      let screens = loadJsonFile(SCREENS_FILE, []);
      const initialCount = screens.length;
      
      screens = screens.filter(s => s.pairingCode !== pairingCode);
      
      if (screens.length < initialCount) {
        saveJsonFile(SCREENS_FILE, screens);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Screen deleted' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Screen not found' }));
      }
      return;
    }

    // POST /screens/pair - Request pairing code for screen
    if (pathname === '/screens/pair' && req.method === 'POST') {
      const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const screens = loadJsonFile(SCREENS_FILE, []);
      
      // Clean up old inactive screens (older than 10 minutes)
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      const activeScreens = screens.filter(s => new Date(s.createdAt).getTime() > tenMinutesAgo);
      
      const newScreen = {
        pairingCode,
        activated: false,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      
      activeScreens.push(newScreen);
      saveJsonFile(SCREENS_FILE, activeScreens);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pairing_code: pairingCode }));
      return;
    }

    // GET /screens/status/:code - Check screen activation status
    if (pathname.startsWith('/screens/status/') && req.method === 'GET') {
      const pairingCode = pathname.split('/')[3];
      const screens = loadJsonFile(SCREENS_FILE, []);
      const screen = screens.find(s => s.pairingCode === pairingCode);
      
      if (screen) {
        // Update last seen
        screen.lastSeen = new Date().toISOString();
        saveJsonFile(SCREENS_FILE, screens);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          activated: screen.activated,
          pairing_code: pairingCode
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Screen not found' }));
      }
      return;
    }

    // POST /screens/activate/:code - Activate a screen (for CMS)
    if (pathname.startsWith('/screens/activate/') && req.method === 'POST') {
      const pairingCode = pathname.split('/')[3];
      const screens = loadJsonFile(SCREENS_FILE, []);
      const screen = screens.find(s => s.pairingCode === pairingCode);
      
      if (screen) {
        screen.activated = true;
        screen.activatedAt = new Date().toISOString();
        saveJsonFile(SCREENS_FILE, screens);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Screen activated' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Screen not found' }));
      }
      return;
    }

    // Default 404 for unknown screen endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Screen endpoint not found' }));
    return;
  }

  // Screen content endpoint
  if (pathname === '/screen/content' && req.method === 'GET') {
    const content = loadJsonFile(CONTENT_FILE, {
      news: [
        { title: 'Welcome', content: 'Welcome to our golf club digital display system' },
        { title: 'Updates', content: 'Check back regularly for club updates and announcements' }
      ],
      rotation_images: [],
      rotation_duration: 5000,
      polls: [],
      weather: null
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...content }));
    return;
  }

  // CMS API endpoints  
  if (pathname.startsWith('/api/')) {
    // Handle CMS login differently from admin login
    if (pathname === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body);
          const user = authenticateUser(username, password);
          
          if (user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              token: 'cms-token-' + Date.now(),
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                organizationId: user.organizationId,
                siteIds: user.siteIds
              }
            }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // CMS logout
    if (pathname === '/api/logout' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Logged out' }));
      return;
    }

    // CMS Sites access (filtered by user permissions)
    if ((pathname === '/api/admin/sites' || pathname === '/api/sites') && req.method === 'GET') {
      // For now, return all sites since we don't validate tokens
      // In a real implementation, we'd decode the JWT token to get user info
      const sites = loadJsonFile(SITES_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: sites }));
      return;
    }

    // New endpoint to get user's accessible sites based on authentication
    if (pathname === '/api/user/sites' && req.method === 'GET') {
      // Extract user info from Authorization header (simplified for demo)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Authorization required' }));
        return;
      }

      // For demo: return all sites for now, but structure is ready for role filtering
      const sites = loadJsonFile(SITES_FILE, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: sites }));
      return;
    }

    // CMS News endpoints
    if (pathname.startsWith('/api/news')) {
      if (pathname === '/api/news' && req.method === 'GET') {
        const news = loadJsonFile(NEWS_FILE, []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: news }));
        return;
      }

      if (pathname === '/api/news' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const news = loadJsonFile(NEWS_FILE, []);
            const newsData = JSON.parse(body);
            const newNews = {
              id: Math.max(0, ...news.map(n => n.id)) + 1,
              title: newsData.title,
              content: newsData.content,
              siteId: newsData.siteId,
              scheduled: newsData.scheduled || null,
              active: true,
              createdAt: new Date().toISOString()
            };
            news.push(newNews);
            saveJsonFile(NEWS_FILE, news);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: newNews }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
        return;
      }
    }

    // CMS Media endpoints  
    if (pathname.startsWith('/api/media')) {
      if (pathname === '/api/media' && req.method === 'GET') {
        const media = loadJsonFile(MEDIA_FILE, []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: media }));
        return;
      }
      
      if (pathname === '/api/media/upload' && req.method === 'POST') {
        // Simple mock response for media upload
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Media upload endpoint - implementation needed' }));
        return;
      }
    }

    // CMS Settings endpoints
    if (pathname.startsWith('/api/settings')) {
      if (pathname === '/api/settings' && req.method === 'GET') {
        const settings = loadJsonFile(SETTINGS_FILE, { theme: 'default', notifications: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: settings }));
        return;
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const settingsData = JSON.parse(body);
            saveJsonFile(SETTINGS_FILE, settingsData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: settingsData }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
        return;
      }
    }

    // Mock endpoints for other CMS features
    const mockEndpoints = ['/api/handicaps', '/api/leaderboard', '/api/polls', '/api/test-db'];
    if (mockEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: [], 
        message: `${pathname} endpoint - implementation in progress` 
      }));
      return;
    }

    // Default 404 for unknown CMS API endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'CMS API endpoint not found' }));
    return;
  }
  
  // CMS HTML file
  if (pathname === '/cms' || pathname === '/cms.html') {
    const cmsPath = path.join(__dirname, 'public', 'cms.html');
    
    fs.readFile(cmsPath, (err, data) => {
      if (err) {
        console.error('Error reading cms.html:', err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('cms.html not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // Screen HTML file
  if (pathname === '/screen' || pathname === '/screen.html') {
    const screenPath = path.join(__dirname, 'public', 'screen.html');
    
    fs.readFile(screenPath, (err, data) => {
      if (err) {
        console.error('Error reading screen.html:', err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('screen.html not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
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
  console.log(`✅ Data refresh: /refresh-data`);
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

