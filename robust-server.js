// robust-server.js - Main server with controlled initialization and robust error handling
console.log('🚀 Starting robust ClubVision server...');
console.log('📊 Environment diagnostics:');
console.log('  - Node version:', process.version);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - PORT:', process.env.PORT || '8080 (default)');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');
console.log('  - Working directory:', process.cwd());

// Global error handlers (non-crashing in production)
process.on('uncaughtException', err => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  // Don't exit in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', err => {
  console.error('❌ UNHANDLED REJECTION:', err);
  // Don't exit in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Load required modules with error handling
let express, cors, multer, path, bcrypt, jwt, Client, session, passport, LocalStrategy;

try {
  express = require('express');
  cors = require('cors');
  multer = require('multer');
  path = require('path');
  bcrypt = require('bcrypt');
  jwt = require('jsonwebtoken');
  ({ Client } = require('pg'));
  session = require('express-session');
  passport = require('passport');
  LocalStrategy = require('passport-local').Strategy;
  console.log('✅ All core modules loaded successfully');
} catch (moduleError) {
  console.error('❌ CRITICAL: Failed to load core modules:', moduleError);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATABASE_URL = process.env.DATABASE_URL;

// Database connection with robust error handling
let client = null;
let databaseReady = false;

if (DATABASE_URL) {
  try {
    client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('✅ Database client created');
  } catch (clientError) {
    console.error('❌ Failed to create database client:', clientError);
    client = null;
  }
} else {
  console.warn('⚠️  DATABASE_URL not set - creating mock client');
  // Mock client for development
  client = {
    connect: () => Promise.resolve(),
    query: () => Promise.resolve({ rows: [] }),
    end: () => Promise.resolve()
  };
}

// Middleware setup
console.log('⚙️  Setting up middleware...');
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check and basic routes FIRST (before any complex initialization)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'robust-server-ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    databaseReady,
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Robust ClubVision API Server',
    status: 'running',
    databaseReady,
    timestamp: new Date().toISOString()
  });
});

// Static file routes
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/cms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cms.html'));
});

// Session configuration (simplified for stability)
console.log('🔑 Setting up session...');
app.use(session({
  secret: process.env.SESSION_SECRET || 'clubvision-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Simplified for now
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport setup (simplified)
console.log('🛡️  Setting up passport...');
app.use(passport.initialize());
app.use(passport.session());

// Simple passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    if (client && databaseReady) {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } else {
      done(null, { id, username: 'offline_user' });
    }
  } catch (error) {
    console.error('Passport deserialization error:', error);
    done(error, null);
  }
});

// Authentication middleware (defined early)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'system_admin') {
      return res.status(403).json({ error: 'System admin access required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Login endpoint (simplified)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!databaseReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin organization creation endpoint (the one that was failing)
app.post('/api/admin/organizations', authenticateAdmin, async (req, res) => {
  try {
    if (!databaseReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const { name, slug, description, contact_email, contact_phone } = req.body;
    
    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    console.log('Creating organization:', { name, slug, description, contact_email, contact_phone });

    const result = await client.query(`
      INSERT INTO organizations (name, slug, description, contact_email, contact_phone, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [name, slug, description, contact_email, contact_phone]);

    console.log('Organization created successfully:', result.rows[0]);
    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ 
      error: 'Failed to create organization',
      details: error.message 
    });
  }
});

// Other essential admin endpoints
app.get('/api/admin/organizations', authenticateAdmin, async (req, res) => {
  try {
    if (!databaseReady) {
      return res.json([]);
    }
    const result = await client.query('SELECT * FROM organizations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.json([]);
  }
});

app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    if (!databaseReady) {
      return res.json({ organizations: 0, sites: 0, users: 0 });
    }
    
    const [orgResult, siteResult, userResult] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM organizations WHERE is_active = true'),
      client.query('SELECT COUNT(*) as count FROM sites WHERE is_active = true'),
      client.query('SELECT COUNT(*) as count FROM users WHERE is_active = true')
    ]);

    res.json({
      organizations: parseInt(orgResult.rows[0].count),
      sites: parseInt(siteResult.rows[0].count),
      users: parseInt(userResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.json({ organizations: 0, sites: 0, users: 0 });
  }
});

// Database initialization (NON-BLOCKING and runs in background)
async function initializeDatabase() {
  if (!DATABASE_URL || !client) {
    console.log('⚠️  Database initialization skipped - no DATABASE_URL configured');
    return;
  }
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    console.log('🏗️  Creating core tables...');
    
    // Organizations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        subscription_plan VARCHAR(50) DEFAULT 'basic',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Organizations table ready');

    // Sites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        domain VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, slug)
      )
    `);
    console.log('✅ Sites table ready');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id),
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        email VARCHAR(255),
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    console.log('✅ Database initialization completed successfully!');
    databaseReady = true;

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.error('Server will continue running with limited functionality');
    databaseReady = false;
  }
}

// Start server with controlled initialization
async function startRobustServer() {
  try {
    console.log('🚀 Starting robust server...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ ROBUST SERVER STARTED SUCCESSFULLY');
      console.log(`✅ Listening on 0.0.0.0:${PORT}`);
      console.log('✅ Server ready to accept requests');
      
      // Initialize database in background (non-blocking)
      console.log('🔄 Starting background database initialization...');
      initializeDatabase().then(() => {
        console.log('🎉 Background database initialization completed');
      }).catch((error) => {
        console.error('⚠️  Background database initialization failed:', error);
        console.log('🔄 Server continues running with limited functionality');
      });
    });
    
    server.on('error', (error) => {
      console.error('❌ Server listen error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
    });
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR starting robust server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Start the server
startRobustServer();