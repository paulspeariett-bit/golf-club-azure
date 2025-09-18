// server-azure.js - Modified for Azure deployment
console.log('🚀 Starting ClubVision Express server...');
console.log('📊 Environment check:');
console.log('  - Node version:', process.version);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - PORT:', process.env.PORT || '8080 (default)');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');
console.log('  - Working directory:', process.cwd());

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
let BlobServiceClient = null;
try {
  ({ BlobServiceClient } = require('@azure/storage-blob'));
} catch (e) {
  console.warn('Azure Blob SDK not installed; media upload to Blob disabled');
}

// OAuth Authentication imports
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
let GoogleStrategy;
try {
  GoogleStrategy = require('passport-google-oauth20').Strategy;
} catch (e) {
  console.warn('passport-google-oauth20 not installed; Google OAuth disabled');
}
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATABASE_URL = process.env.DATABASE_URL;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

// OAuth Configuration
const OAUTH_CONFIG = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || '1015140206386-lke7d8792ccig31sfbpii7v4hvlmk42a.apps.googleusercontent.com',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://golf-club-poc-2024-dth0c4hjd8ayfuf8.uksouth-01.azurewebsites.net/auth/google/callback'
  }
};

// Initialize Azure Blob Storage
let blobServiceClient;
if (AZURE_STORAGE_CONNECTION_STRING && BlobServiceClient) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  } catch (e) {
    console.warn('Failed to initialize Azure Blob client:', e.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Azure App Service
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'ClubVision API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Direct route for admin.html (fixes Azure routing issues)
// Direct route for onboarding-wireframe.html
app.get('/onboarding-wireframe.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'onboarding-wireframe.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Direct route for /admin (no .html)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Direct routes for CMS
app.get('/cms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cms.html'));
});
app.get('/cms.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cms.html'));
});
// Temporary endpoint to promote 'admin' user to system_admin role

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'clubvision-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// PASSPORT AUTHENTICATION STRATEGIES
// ============================================

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy (username/password)
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];
      
      if (!user) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      
      // Update last login
      await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Google OAuth Strategy (with error handling)
try {
  passport.use(new GoogleStrategy(OAUTH_CONFIG.google, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let result = await client.query('SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2', ['google', profile.id]);
      let user = result.rows[0];
      
      if (user) {
        // Update last login
        await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        return done(null, user);
      }
      
      // Check if user exists with same email
      if (profile.emails && profile.emails.length > 0) {
        result = await client.query('SELECT * FROM users WHERE email = $1', [profile.emails[0].value]);
        user = result.rows[0];
        
        if (user) {
        // Link this OAuth account to existing user
        await client.query(
          'UPDATE users SET oauth_provider = $1, oauth_id = $2, last_login = CURRENT_TIMESTAMP WHERE id = $3',
          ['google', profile.id, user.id]
        );
        return done(null, user);
      }
    }
    
    // Create new user - for system admin access only initially
    if (profile.emails && profile.emails[0].value.includes('clubvision.com')) {
      const newUser = await client.query(`
        INSERT INTO users (username, email, full_name, role, oauth_provider, oauth_id, password, site_id, last_login)
        VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM sites WHERE slug = 'greenfield-golf'), CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        profile.emails[0].value,
        profile.emails[0].value,
        profile.displayName,
        'system_admin',
        'google',
        profile.id,
        'oauth-no-password'
      ]);
      
      return done(null, newUser.rows[0]);
    } else {
      // For non-system admin emails, require manual approval/site assignment
      return done(null, false, { message: 'Account requires approval. Contact your system administrator.' });
    }
    
  } catch (error) {
    return done(error);
  }
}));

} catch (strategyError) {
  console.error('Google OAuth Strategy initialization failed:', strategyError.message);
  console.log('OAuth authentication will not be available');
}

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lightweight health check (no external deps)
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    pid: process.pid,
    node: process.version,
    time: new Date().toISOString(),
  });
});

// Basic info endpoint to confirm server is up
app.get('/version', (req, res) => {
  res.type('text/plain').send('ClubVision server is running');
});

app.get('/cms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cms.html'));
});

app.get('/screen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'screen.html'));
});

// Database connection
let client;
if (DATABASE_URL) {
  client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.warn('DATABASE_URL not set - database features will be disabled');
  // Create a mock client to prevent crashes
  client = {
    connect: () => Promise.resolve(),
    query: () => Promise.resolve({ rows: [] }),
    end: () => Promise.resolve()
  };
}

// Initialize database
async function initializeDatabase() {
  if (!DATABASE_URL) {
    console.log('Database initialization skipped - no DATABASE_URL configured');
    return;
  }
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // ============================================
    // CLUBVISION MULTI-TENANT SCHEMA
    // ============================================
    
    // 1. Organizations table (top level - ClubVision system)
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        subscription_plan VARCHAR(50) DEFAULT 'basic',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Sites table (individual golf clubs/sports clubs)
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

    // 3. Site branding configuration
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_branding (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        cms_title VARCHAR(255) DEFAULT 'Club CMS',
        cms_primary_color VARCHAR(7) DEFAULT '#007bff',
        cms_secondary_color VARCHAR(7) DEFAULT '#6c757d',
        cms_background_color VARCHAR(7) DEFAULT '#f8f9fa',
        cms_logo_url TEXT,
        screen_title VARCHAR(255) DEFAULT 'Welcome to Our Club',
        screen_primary_color VARCHAR(7) DEFAULT '#1e3c72',
        screen_secondary_color VARCHAR(7) DEFAULT '#2a5298',
        screen_background_color VARCHAR(7) DEFAULT '#ffffff',
        screen_logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_site_branding UNIQUE (site_id)
      )
    `);

    // ============================================
    // MIGRATE TO MULTI-TENANT STRUCTURE
    // ============================================
    
    // Create default organization if none exists
    const orgCount = await client.query('SELECT COUNT(*) FROM organizations');
    if (parseInt(orgCount.rows[0].count) === 0) {
      console.log('Creating default ClubVision organization...');
      await client.query(`
        INSERT INTO organizations (name, slug, subscription_plan) 
        VALUES ('ClubVision', 'clubvision', 'enterprise')
      `);
    }

    // Create default site if none exists
    const siteCount = await client.query('SELECT COUNT(*) FROM sites');
    if (parseInt(siteCount.rows[0].count) === 0) {
      console.log('Creating default golf club site...');
      await client.query(`
        INSERT INTO sites (organization_id, name, slug, domain) 
        VALUES (
          (SELECT id FROM organizations WHERE slug = 'clubvision'),
          'Greenfield Golf Club', 
          'greenfield-golf', 
          'golf-club-poc-2024-dth0c4hjd8ayfuf8.uksouth-01.azurewebsites.net'
        )
      `);
    }

    // Create default branding
    await client.query(`
      INSERT INTO site_branding (site_id, cms_title, screen_title) 
      VALUES (
        (SELECT id FROM sites WHERE slug = 'greenfield-golf'),
        'Greenfield Golf Club CMS',
        'Welcome to Greenfield Golf Club'
      ) 
      ON CONFLICT (site_id) DO NOTHING
    `);

    // ============================================
    // EXISTING TABLES WITH SITE_ID MIGRATION
    // ============================================
    
    // Create tables (keeping existing structure but adding site_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        site_id INTEGER REFERENCES sites(id),
        email VARCHAR(255) UNIQUE,
        full_name VARCHAR(255),
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP
      )
    `);

    // Add site_id to existing tables if not exists
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP');
      console.log('Enhanced users table with OAuth and multi-tenant support');
    } catch (err) {
      console.log('Users table columns may already exist');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        scheduled_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR(50)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        path VARCHAR(500) NOT NULL,
        type VARCHAR(100) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS handicaps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        handicap DECIMAL(4,1) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(100) NOT NULL,
        score INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS screens (
        id SERIAL PRIMARY KEY,
        pairing_code VARCHAR(20) UNIQUE,
        activated BOOLEAN DEFAULT FALSE,
        pairing_code_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migrate old screen table structure if needed
    try {
      await client.query(`ALTER TABLE screens ADD COLUMN IF NOT EXISTS activated BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE screens ADD COLUMN IF NOT EXISTS pairing_code_expiry TIMESTAMP`);
      await client.query(`ALTER TABLE screens DROP COLUMN IF EXISTS paired`);
      await client.query(`ALTER TABLE screens DROP COLUMN IF EXISTS activated_at`);
    } catch (error) {
      console.log('Screen table migration completed or not needed:', error.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        options JSON NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default users
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedContentPassword = await bcrypt.hash('content123', 10);
    
    await client.query(`
      INSERT INTO users (username, password, role) 
      VALUES ($1, $2, $3), ($4, $5, $6)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', hashedAdminPassword, 'admin', 'content', hashedContentPassword, 'content_manager']);

    // Insert default settings
    await client.query(`
      INSERT INTO settings (key, value) 
      VALUES 
        ('rotationDuration', '5000'),
        ('activeContent', 'handicaps'),
        ('currentRotation', '[]')
      ON CONFLICT (key) DO NOTHING
    `);

    // ============================================
    // ADD SITE_ID TO ALL EXISTING TABLES
    // ============================================
    try {
      // Add site_id columns to existing tables
      await client.query('ALTER TABLE news ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE handicaps ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE screens ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE polls ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      await client.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id)');
      
      console.log('Added site_id columns to existing tables');

      // Get default site ID for migration
      const defaultSite = await client.query("SELECT id FROM sites WHERE slug = 'greenfield-golf'");
      if (defaultSite.rows.length > 0) {
        const siteId = defaultSite.rows[0].id;
        
        // Migrate existing data to belong to default site
        await client.query('UPDATE users SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE news SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE media SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE handicaps SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE leaderboard SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE screens SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE polls SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        await client.query('UPDATE settings SET site_id = $1 WHERE site_id IS NULL', [siteId]);
        
        console.log('Migrated existing records to default site');
      }
    } catch (migrationError) {
      console.log('Migration might already be completed:', migrationError.message);
    }

    // ============================================
    // CREATE SYSTEM ADMIN USER
    // ============================================
    try {
      const systemAdminCheck = await client.query("SELECT COUNT(*) FROM users WHERE role = 'system_admin'");
      if (parseInt(systemAdminCheck.rows[0].count) === 0) {
        console.log('Creating default system admin user...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await client.query(`
          INSERT INTO users (username, password, role, email, full_name, site_id) 
          VALUES ('system_admin', $1, 'system_admin', 'admin@clubvision.com', 'System Administrator', 
                  (SELECT id FROM sites WHERE slug = 'greenfield-golf'))
        `, [hashedPassword]);
        console.log('Created system admin user: system_admin / admin123');
      }
    } catch (adminError) {
      console.log('System admin user may already exist');
    }

    // Add missing columns to organizations table for admin functionality
    try {
      await client.query(`
        ALTER TABLE organizations 
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)
      `);
      console.log('Added missing columns to organizations table');
    } catch (alterError) {
      console.log('Organizations table columns may already exist:', alterError.message);
    }

    console.log('Database initialized successfully - ClubVision Multi-Tenant Schema Ready!');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// File upload configuration for Azure Blob Storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Authentication middleware
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

// Admin authentication middleware
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

// API Routes
// =============================
// ONBOARDING GET PROGREALTER TABLE organizations ADD COLUMN description TEXT;ALTER TABLE organizations ADD COLUMN description TEXT;
// SS ENDPOINT (secured)
// =============================
app.get('/api/onboarding/get-progress', authenticateAdmin, async (req, res) => {
  const site_id = parseInt(req.query.site_id);
  if (!site_id) return res.status(400).json({ error: 'site_id required' });
  try {
    const result = await client.query('SELECT progress FROM onboarding_progress WHERE site_id = $1', [site_id]);
    if (result.rows.length === 0) return res.json({ progress: null });
    res.json({ progress: result.rows[0].progress });
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});
// =============================
// ONBOARDING SAVE/RESUME ENDPOINT (secured)
// =============================
app.post('/api/onboarding/save-progress', authenticateAdmin, async (req, res) => {
  const { site_id, progress } = req.body;
  if (!site_id || !progress) return res.status(400).json({ error: 'site_id and progress required' });
  try {
    // Create table if not exists
    await client.query(`CREATE TABLE IF NOT EXISTS onboarding_progress (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      progress JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id)
    )`);
    // Upsert progress
    await client.query(`
      INSERT INTO onboarding_progress (site_id, progress, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (site_id) DO UPDATE SET progress = $2, updated_at = CURRENT_TIMESTAMP
    `, [site_id, JSON.stringify(progress)]);
    res.json({ saved: true });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});
// =============================
// EMAIL VERIFICATION ENDPOINTS
// =============================
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('nodemailer not installed; email sending disabled');
}
const verificationCodes = {};

// Configure nodemailer (use your SMTP or a test service)
let mailTransport = null;
if (nodemailer) {
  try {
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER || 'your-ethereal-user',
        pass: process.env.SMTP_PASS || 'your-ethereal-pass'
      }
    });
  } catch (e) {
    console.warn('Failed to create mail transport; emails will be logged only');
  }
}

app.post('/api/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };
  try {
    if (mailTransport) {
      await mailTransport.sendMail({
        from: 'ClubVision <noreply@clubvision.com>',
        to: email,
        subject: 'Your ClubVision Verification Code',
        text: `Your verification code is: ${code}`
      });
      res.json({ sent: true });
    } else {
      console.log(`[DEV] Email to ${email}: code ${code}`);
      res.json({ sent: true, dev: true });
    }
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  const entry = verificationCodes[email];
  if (!entry || entry.expires < Date.now()) {
    return res.json({ verified: false, error: 'Code expired or not found' });
  }
  if (entry.code === code) {
    delete verificationCodes[email];
    return res.json({ verified: true });
  }
  res.json({ verified: false, error: 'Invalid code' });
});

// =============================
// ONBOARDING QUICK-START ENDPOINTS
// =============================
app.post('/api/onboarding/apply-template', authenticateAdmin, async (req, res) => {
  const { site_id, template } = req.body || {};
  if (!site_id) return res.status(400).json({ error: 'site_id required' });
  const tpl = (template || 'classic').toLowerCase();
  // Simple presets for titles; can be expanded later
  const presets = {
    classic: { cms_title: 'ClubVision CMS', screen_title: 'Welcome to Our Club' },
    modern: { cms_title: 'ClubVision Studio', screen_title: 'Today at the Club' },
    minimal: { cms_title: 'Club Dashboard', screen_title: 'Club Updates' }
  };
  const chosen = presets[tpl] || presets.classic;
  try {
    // Ensure site exists
    const exists = await client.query('SELECT 1 FROM sites WHERE id = $1', [site_id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'site not found' });

    // Upsert branding
    await client.query(`
      INSERT INTO site_branding (site_id, cms_title, screen_title)
      VALUES ($1, $2, $3)
      ON CONFLICT (site_id) DO UPDATE SET cms_title = EXCLUDED.cms_title, screen_title = EXCLUDED.screen_title
    `, [site_id, chosen.cms_title, chosen.screen_title]);

    // Optionally adjust settings (table uses key as primary key)
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('activeContent', 'leaderboard')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `);
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('rotationDuration', '5000')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `);

    res.json({ applied: true, template: tpl });
  } catch (err) {
    console.error('Apply template error:', err);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

app.post('/api/onboarding/sample/announcements', authenticateAdmin, async (req, res) => {
  const { site_id } = req.body || {};
  if (!site_id) return res.status(400).json({ error: 'site_id required' });
  try {
    const exists = await client.query('SELECT 1 FROM sites WHERE id = $1', [site_id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'site not found' });

    const rows = [
      ['Welcome to ClubVision', 'Your digital clubhouse is now live. Explore features and customize your screens.', null, 'system'],
      ['Pro Shop Sale', 'Get 20% off balls and gloves this weekend only.', null, 'pro_shop'],
      ['Course Notice', 'Hole 7 is cart path only due to maintenance.', null, 'course_ops']
    ];
    const values = rows.map((r, i) => `($1, $${i*4+2}, $${i*4+3}, $${i*4+4}, $${i*4+5})`).join(',');
    const params = [site_id];
    rows.forEach(r => params.push(r[0], r[1], r[2], r[3]));
    const result = await client.query(
      `INSERT INTO news (site_id, title, content, scheduled_date, author) VALUES ${values} RETURNING id`,
      params
    );
    res.json({ inserted: result.rowCount });
  } catch (err) {
    console.error('Sample announcements error:', err);
    res.status(500).json({ error: 'Failed to create announcements' });
  }
});

app.post('/api/onboarding/sample/events', authenticateAdmin, async (req, res) => {
  const { site_id } = req.body || {};
  if (!site_id) return res.status(400).json({ error: 'site_id required' });
  try {
    const exists = await client.query('SELECT 1 FROM sites WHERE id = $1', [site_id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'site not found' });

    const now = new Date();
    const plusDays = d => new Date(now.getTime() + d*24*60*60*1000);
    const rows = [
      ['Member Scramble', 'Join our 9-hole scramble. Sign up in the pro shop.', plusDays(3), 'events'],
      ['Junior Clinic', 'Coaching session for juniors ages 8-14.', plusDays(7), 'events'],
      ['Night Golf', 'Glow-ball 4-person scramble. Limited spots.', plusDays(14), 'events']
    ];
    const values = rows.map((r, i) => `($1, $${i*4+2}, $${i*4+3}, $${i*4+4}, $${i*4+5})`).join(',');
    const params = [site_id];
    rows.forEach(r => params.push(r[0], r[1], r[2], r[3]));
    const result = await client.query(
      `INSERT INTO news (site_id, title, content, scheduled_date, author) VALUES ${values} RETURNING id`,
      params
    );
    res.json({ inserted: result.rowCount });
  } catch (err) {
    console.error('Sample events error:', err);
    res.status(500).json({ error: 'Failed to create events' });
  }
});

app.post('/api/onboarding/sample/leaderboard', authenticateAdmin, async (req, res) => {
  const { site_id } = req.body || {};
  if (!site_id) return res.status(400).json({ error: 'site_id required' });
  try {
    const exists = await client.query('SELECT 1 FROM sites WHERE id = $1', [site_id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'site not found' });

    const players = [
      ['Alex Carter', 70], ['Sam Patel', 72], ['Jamie Lee', 69], ['Chris Morgan', 74], ['Taylor Chen', 71]
    ];
    const values = players.map((p, i) => `($1, $${i*2+2}, $${i*2+3})`).join(',');
    const params = [site_id];
    players.forEach(p => params.push(p[0], p[1]));
    const result = await client.query(
      `INSERT INTO leaderboard (site_id, player_name, score) VALUES ${values} RETURNING id`,
      params
    );
    res.json({ inserted: result.rowCount });
  } catch (err) {
    console.error('Sample leaderboard error:', err);
    res.status(500).json({ error: 'Failed to create leaderboard' });
  }
});

// =============================
// ONBOARDING COMPLETION: Create Organization + Site (secured)
// =============================
app.post('/api/onboarding/complete', authenticateAdmin, async (req, res) => {
  const { organization, site, organization_id } = req.body || {};

  // Basic validation
  if (!site || !site.name || !site.slug) {
    return res.status(400).json({ error: 'site.name and site.slug are required' });
  }

  // Helper to sanitize slug
  const sanitizeSlug = (s) => String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const slug = sanitizeSlug(site.slug);
  if (!slug) {
    return res.status(400).json({ error: 'Invalid slug after sanitization' });
  }

  const clientConn = client; // Using shared client; in future consider transaction with BEGIN/COMMIT
  try {
    let orgRecord = null;
    let orgId = organization_id || null;

    if (!orgId) {
      if (!organization || !organization.name) {
        return res.status(400).json({ error: 'organization.name required when no organization_id provided' });
      }
      const orgResult = await clientConn.query(
        `INSERT INTO organizations (name, description, contact_email, contact_phone) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [organization.name, organization.description || null, organization.contact_email || null, organization.contact_phone || null]
      );
      orgRecord = orgResult.rows[0];
      orgId = orgRecord.id;
    } else {
      const checkOrg = await clientConn.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
      if (checkOrg.rowCount === 0) return res.status(404).json({ error: 'organization_id not found' });
      orgRecord = checkOrg.rows[0];
    }

    // Create site
    const siteResult = await clientConn.query(
      `INSERT INTO sites (name, slug, organization_id, contact_email, contact_phone, address) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [site.name, slug, orgId, site.contact_email || null, site.contact_phone || null, site.address || null]
    );
    const siteRecord = siteResult.rows[0];

    // Ensure branding row exists
    await clientConn.query(`INSERT INTO site_branding (site_id) VALUES ($1) ON CONFLICT (site_id) DO NOTHING`, [siteRecord.id]);

    // Optionally mark onboarding as complete for this site
    try {
      await clientConn.query(`CREATE TABLE IF NOT EXISTS onboarding_progress (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
        progress JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_id)
      )`);
      await clientConn.query(`
        INSERT INTO onboarding_progress (site_id, progress, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (site_id) DO UPDATE SET progress = $2, updated_at = CURRENT_TIMESTAMP
      `, [siteRecord.id, JSON.stringify([{ step: 'Onboarding Complete', complete: true }])]);
    } catch (e) {
      console.warn('Failed to upsert onboarding completion progress:', e.message);
    }

    return res.json({ organization: orgRecord, site: siteRecord });
  } catch (err) {
    console.error('Onboarding completion error:', err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Duplicate key (possibly slug); choose a different slug' });
    }
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Authentication
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// OAUTH AUTHENTICATION ROUTES
// ============================================

// Google OAuth routes (with error handling)
try {
  app.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login-failure' }),
    async (req, res) => {
      // Successful authentication
      const token = jwt.sign(
        { userId: req.user.id, username: req.user.username, role: req.user.role, siteId: req.user.site_id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Redirect to CMS with token in URL hash for client-side retrieval
      res.redirect(`/cms.html#token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        site_id: req.user.site_id
      }))}`);
    }
  );
} catch (oauthRouteError) {
  console.error('OAuth routes initialization failed:', oauthRouteError.message);
  console.log('OAuth routes will not be available');
}

// Enhanced login endpoint with OAuth support
app.post('/api/login-oauth', passport.authenticate('local'), (req, res) => {
  const token = jwt.sign(
    { userId: req.user.id, username: req.user.username, role: req.user.role, siteId: req.user.site_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    token,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      site_id: req.user.site_id,
      email: req.user.email,
      full_name: req.user.full_name
    }
  });
});

// Test OAuth modules loading
app.get('/api/oauth-status', (req, res) => {
  try {
    const passportStatus = passport ? 'loaded' : 'not loaded';
    const googleStrategyStatus = GoogleStrategy ? 'loaded' : 'not loaded';
    const sessionStatus = session ? 'loaded' : 'not loaded';
    
    res.json({
      passport: passportStatus,
      googleStrategy: googleStrategyStatus,
      session: sessionStatus,
      oauth_config: {
        google_client_id: OAUTH_CONFIG.google.clientID ? 'configured' : 'not configured'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'OAuth module check failed', 
      message: error.message 
    });
  }
});

// Login failure page
app.get('/login-failure', (req, res) => {
  res.send(`
    <html>
      <head><title>Login Failed</title></head>
      <body>
        <h1>Authentication Failed</h1>
        <p>Your account requires approval or is not authorized for this system.</p>
        <p>Please contact your system administrator.</p>
        <a href="/cms.html">Return to Login</a>
      </body>
    </html>
  `);
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// News Management
app.get('/api/news', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/news', authenticateToken, async (req, res) => {
  const { title, content, scheduled_date } = req.body;
  
  try {
    const result = await client.query(
      'INSERT INTO news (title, content, scheduled_date, author) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, scheduled_date || null, req.user.username]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Media Management with Azure Blob Storage
app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const containerClient = blobServiceClient.getContainerClient('uploads');
    const blobName = Date.now() + '-' + req.file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.upload(req.file.buffer, req.file.buffer.length);
    
    const blobUrl = blockBlobClient.url;
    
    const result = await client.query(
      'INSERT INTO media (filename, original_name, path, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [blobName, req.file.originalname, blobUrl, req.file.mimetype]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/media', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM media ORDER BY uploaded_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM media WHERE id = $1', [req.params.id]);
    if (result.rowCount > 0) {
      res.json({ message: 'Media deleted successfully' });
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Forbidden
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};

// Middleware for role-based access
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.sendStatus(403); // Forbidden
    }
  };
};

// Test endpoint for debugging
app.get('/api/test-db', authenticateJWT, async (req, res) => {
  try {
    console.log('Testing database connection...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Database test successful:', result.rows[0]);
    res.json({ status: 'success', time: result.rows[0].current_time });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Screen pairing and activation endpoints
app.post('/api/screens/pair', async (req, res) => {
  console.log('Pairing code generation requested by screen');
  
  const pairing_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  try {
    console.log('Attempting to clean up expired codes...');
    await client.query('DELETE FROM screens WHERE pairing_code_expiry < NOW()');
    console.log('Cleanup complete, inserting new pairing code:', pairing_code);
    
    // Insert new pairing code
    const result = await client.query('INSERT INTO screens (pairing_code, pairing_code_expiry, activated) VALUES ($1, $2, FALSE) RETURNING id', [pairing_code, expiry]);
    console.log('Insert successful, record ID:', result.rows[0]?.id);
    
    res.json({ pairing_code });
  } catch (error) {
    console.error('Error generating pairing code:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({ error: error.message, details: error.detail || 'No additional details' });
  }
});

// Basic database test endpoint
app.get('/api/debug/db-test', async (req, res) => {
  try {
    console.log('DEBUG: Testing database connection...');
    await client.query('SELECT 1');
    
    console.log('DEBUG: Checking screens table...');
    const tableResult = await client.query("SELECT COUNT(*) as count FROM screens");
    
    console.log('DEBUG: Getting all screens...');
    const allScreens = await client.query("SELECT * FROM screens ORDER BY created_at DESC LIMIT 5");
    
    res.json({
      status: 'Database connection OK',
      screens_count: tableResult.rows[0].count,
      recent_screens: allScreens.rows
    });
  } catch (error) {
    console.error('DEBUG: Database test failed:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Test endpoint for activation without auth (for debugging)
app.post('/api/screens/activate-test', async (req, res) => {
  const { pairing_code } = req.body;
  console.log('TEST: Activation request received for pairing code:', pairing_code);
  
  if (!pairing_code) {
    console.log('TEST: No pairing code provided');
    return res.status(400).json({ error: 'Pairing code is required' });
  }
  
  try {
    console.log('TEST: Testing database connection...');
    await client.query('SELECT 1');
    console.log('TEST: Database connection OK');
    
    console.log('TEST: Searching for pairing code in database...');
    const checkResult = await client.query(
      'SELECT id, activated, pairing_code_expiry FROM screens WHERE pairing_code = $1',
      [pairing_code]
    );
    
    console.log('TEST: Check result rows:', checkResult.rows.length);
    console.log('TEST: Check result data:', checkResult.rows);
    
    if (checkResult.rows.length === 0) {
      console.log('TEST: Pairing code not found');
      return res.status(400).json({ error: 'Invalid pairing code - not found in database' });
    }
    
    const screen = checkResult.rows[0];
    console.log('TEST: Found screen record:', screen);
    
    res.json({ 
      message: 'Test successful - found screen record',
      screen: screen,
      debug: 'This is the test endpoint without authentication'
    });
  } catch (error) {
    console.error('TEST: Error:', error);
    console.error('TEST: Error stack:', error.stack);
    res.status(500).json({ error: `Database error: ${error.message}`, stack: error.stack });
  }
});

app.post('/api/screens/activate', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { pairing_code } = req.body;
  console.log('Activation request received for pairing code:', pairing_code, 'from user:', req.user?.username);
  
  if (!pairing_code) {
    console.log('No pairing code provided in request');
    return res.status(400).json({ error: 'Pairing code is required' });
  }
  
  try {
    console.log('Testing database connection...');
    await client.query('SELECT 1'); // Test connection
    console.log('Database connection OK');
    
    console.log('Checking if screens table exists...');
    const tableCheck = await client.query("SELECT to_regclass('public.screens') as table_exists");
    console.log('Table check result:', tableCheck.rows[0]);
    
    if (!tableCheck.rows[0].table_exists) {
      console.log('Screens table does not exist, creating it...');
      await client.query(`
        CREATE TABLE screens (
          id SERIAL PRIMARY KEY,
          pairing_code VARCHAR(20) UNIQUE,
          activated BOOLEAN DEFAULT FALSE,
          pairing_code_expiry TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Screens table created');
    }
    
    console.log('Searching for pairing code in database...');
    // First check if the pairing code exists and is valid
    const checkResult = await client.query(
      'SELECT id, activated, pairing_code_expiry FROM screens WHERE pairing_code = $1',
      [pairing_code]
    );
    
    console.log('Check result rows:', checkResult.rows.length);
    
    if (checkResult.rows.length === 0) {
      console.log('Pairing code not found in database');
      return res.status(400).json({ error: 'Invalid pairing code - not found in database' });
    }
    
    const screen = checkResult.rows[0];
    console.log('Found screen record:', screen);
    
    if (new Date(screen.pairing_code_expiry) < new Date()) {
      console.log('Pairing code has expired');
      return res.status(400).json({ error: 'Pairing code has expired' });
    }
    
    if (screen.activated) {
      console.log('Screen is already activated');
      return res.status(400).json({ error: 'Screen is already activated' });
    }
    
    // Activate the screen
    console.log('Attempting to activate screen...');
    const result = await client.query(
      'UPDATE screens SET activated = true WHERE pairing_code = $1 AND pairing_code_expiry > NOW()',
      [pairing_code]
    );
    
    console.log('Update result:', result.rowCount, 'rows affected');
    
    if (result.rowCount > 0) {
      console.log('Screen activated successfully');
      res.json({ message: 'Screen activated successfully' });
    } else {
      console.log('No rows were updated - possible race condition');
      res.status(400).json({ error: 'Failed to activate screen - possible race condition' });
    }
  } catch (error) {
    console.error('Error activating screen:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

app.get('/api/screens/status/:pairing_code', async (req, res) => {
  try {
    const result = await client.query('SELECT activated FROM screens WHERE pairing_code = $1', [req.params.pairing_code]);
    if (result.rows.length > 0) {
      res.json({ activated: result.rows[0].activated });
    } else {
      res.status(404).json({ activated: false, message: "Code not found." });
    }
  } catch (error) {
    console.error('Error checking screen status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Screen content endpoint
app.get('/api/screen/content', async (req, res) => {
  try {
    const [newsResult, mediaResult, handicapsResult, leaderboardResult, pollsResult, settingsResult] = await Promise.all([
      client.query('SELECT * FROM news WHERE scheduled_date IS NULL OR scheduled_date <= NOW() ORDER BY created_at DESC'),
      client.query('SELECT * FROM media ORDER BY uploaded_at DESC'),
      client.query('SELECT * FROM handicaps ORDER BY name'),
      client.query('SELECT * FROM leaderboard ORDER BY score ASC'),
      client.query('SELECT * FROM polls WHERE active = true'),
      client.query('SELECT * FROM settings')
    ]);

    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.key === 'currentRotation' ? JSON.parse(row.value) : row.value;
    });

    const content = {
      news: newsResult.rows,
      rotation_images: mediaResult.rows.filter(m => m.type.startsWith('image/')),
      rotation_duration: parseInt(settings.rotationDuration) || 5000,
      handicaps: settings.activeContent === 'handicaps' ? handicapsResult.rows : [],
      leaderboard: settings.activeContent === 'leaderboard' ? leaderboardResult.rows : [],
      current_time: new Date().toISOString(),
      polls: pollsResult.rows
    };

    res.json(content);
  } catch (error) {
    console.error('Error fetching screen content:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Settings endpoints
app.put('/api/settings', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { rotationDuration, activeContent } = req.body;
  console.log('Settings update request:', { rotationDuration, activeContent });
  
  try {
    // Update rotation duration
    if (rotationDuration !== undefined) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['rotationDuration', rotationDuration.toString()]
      );
    }
    
    // Update active content
    if (activeContent !== undefined) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['activeContent', activeContent]
      );
    }
    
    console.log('Settings updated successfully');
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYSTEM ADMIN API ENDPOINTS
// ============================================

// Admin dashboard stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM organizations WHERE is_active = true'),
      client.query('SELECT COUNT(*) as count FROM sites WHERE is_active = true'),
      client.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      client.query('SELECT COUNT(*) as count FROM screens WHERE is_active = true')
    ]);

    res.json({
      organizations: parseInt(stats[0].rows[0].count),
      sites: parseInt(stats[1].rows[0].count),
      users: parseInt(stats[2].rows[0].count),
      screens: parseInt(stats[3].rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Organizations management
app.get('/api/admin/organizations', authenticateAdmin, async (req, res) => {
  try {
    const result = await client.query(`
      SELECT o.*, 
             COUNT(s.id) as site_count
      FROM organizations o
      LEFT JOIN sites s ON o.id = s.organization_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/organizations', authenticateAdmin, async (req, res) => {
  const { name, slug, description, contact_email, contact_phone } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required.' });
  }
  try {
    const query = `INSERT INTO organizations (name, slug, description, contact_email, contact_phone) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const params = [name, slug, description, contact_email, contact_phone];
    try {
      const result = await client.query(query, params);
      res.json(result.rows[0]);
    } catch (sqlError) {
      console.error('SQL error creating organization:', { query, params, sqlError });
      res.status(500).json({ error: sqlError.message, code: sqlError.code, detail: sqlError.detail, position: sqlError.position });
    }
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sites management
app.get('/api/admin/sites', authenticateAdmin, async (req, res) => {
  try {
    const result = await client.query(`
      SELECT s.*, 
             o.name as organization_name,
             COUNT(u.id) as user_count
      FROM sites s
      LEFT JOIN organizations o ON s.organization_id = o.id
      LEFT JOIN users u ON s.id = u.site_id
      GROUP BY s.id, o.name
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/sites', authenticateAdmin, async (req, res) => {
  const { name, slug, organization_id, contact_email, contact_phone, address } = req.body;
  
  try {
    const result = await client.query(
      `INSERT INTO sites (name, slug, organization_id, contact_email, contact_phone, address) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, slug, organization_id, contact_email, contact_phone, address]
    );
    
    // Create default branding for the site
    await client.query(
      `INSERT INTO site_branding (site_id) VALUES ($1)`,
      [result.rows[0].id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Users management
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const result = await client.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, 
             u.last_login, u.created_at, u.oauth_provider,
             s.name as site_name
      FROM users u
      LEFT JOIN sites s ON u.site_id = s.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/users', authenticateAdmin, async (req, res) => {
  const { username, email, full_name, role, site_id, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (username, email, full_name, role, site_id, password) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, full_name, role, site_id, created_at`,
      [username, email, full_name, role, site_id, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// User management actions
app.put('/api/admin/users/:id/status', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  try {
    const result = await client.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *',
      [is_active, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user status endpoint
app.put('/api/admin/users/:id/status', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  try {
    await client.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete organization endpoint
app.delete('/api/admin/organizations/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Delete organization (CASCADE will delete associated sites and users)
    await client.query('DELETE FROM organizations WHERE id = $1', [id]);
    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete site endpoint
app.delete('/api/admin/sites/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Delete site (CASCADE will delete associated users)
    await client.query('DELETE FROM sites WHERE id = $1', [id]);
    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// System logs endpoint
app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
  try {
    // For now, return mock logs. In production, this would read actual system logs
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        event: 'Admin Dashboard Access',
        details: `System admin ${req.user.username} accessed admin dashboard`
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'INFO',
        event: 'Database Connection',
        details: 'Database connection pool initialized successfully'
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'INFO',
        event: 'Server Start',
        details: 'ClubVision server started successfully'
      }
    ];
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Global error handlers for diagnostics (set up early)
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
  // Don't exit in production to prevent container restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
  // Don't exit in production to prevent container restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ ClubVision server running on 0.0.0.0:${PORT}`);
      console.log(`✅ Server ready to accept requests`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Server listen error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
    });
    
  } catch (error) {
    console.error('❌ Server startup error:', error);
    console.error('❌ Stack trace:', error.stack);
    // Start server anyway for diagnostic purposes
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚠️  Server running on 0.0.0.0:${PORT} (with startup warnings)`);
      console.log(`⚠️  Some features may not work properly`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Fallback server error:', error);
    });
  }
}

// Start the server
startServer();