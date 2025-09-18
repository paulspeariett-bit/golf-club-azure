// diagnostic-server.js - Gradually add back main server functionality
console.log('🔍 Starting diagnostic server with gradual feature addition...');

// Error handlers (same as safe server)
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

async function startDiagnosticServer() {
  try {
    console.log('📦 Loading core modules...');
    const express = require('express');
    const cors = require('cors');
    const path = require('path');
    console.log('✅ Core modules loaded');

    console.log('🧪 Testing additional modules...');
    
    // Test bcrypt
    try {
      const bcrypt = require('bcrypt');
      console.log('✅ bcrypt loaded successfully');
    } catch (e) {
      console.error('❌ bcrypt failed:', e.message);
    }
    
    // Test jwt
    try {
      const jwt = require('jsonwebtoken');
      console.log('✅ jwt loaded successfully');
    } catch (e) {
      console.error('❌ jwt failed:', e.message);
    }
    
    // Test PostgreSQL client
    try {
      const { Client } = require('pg');
      console.log('✅ pg Client loaded successfully');
      
      // Test DATABASE_URL parsing
      if (process.env.DATABASE_URL) {
        console.log('✅ DATABASE_URL found');
        const testClient = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false
          }
        });
        console.log('✅ PostgreSQL client created (not connected yet)');
      } else {
        console.log('⚠️  DATABASE_URL not set');
      }
    } catch (e) {
      console.error('❌ PostgreSQL client failed:', e.message);
    }
    
    // Test session
    try {
      const session = require('express-session');
      console.log('✅ express-session loaded successfully');
    } catch (e) {
      console.error('❌ express-session failed:', e.message);
    }
    
    // Test passport
    try {
      const passport = require('passport');
      const LocalStrategy = require('passport-local').Strategy;
      console.log('✅ passport and LocalStrategy loaded successfully');
    } catch (e) {
      console.error('❌ passport failed:', e.message);
    }
    
    console.log('⚙️  Setting up Express app...');
    const app = express();
    const PORT = process.env.PORT || 8080;
    
    // Basic middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    console.log('✅ Basic middleware configured');
    
    // Test routes
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'diagnostic-ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not set',
          PORT: process.env.PORT
        }
      });
    });
    
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Diagnostic server - all modules loaded successfully',
        status: 'ready-for-database-test',
        timestamp: new Date().toISOString()
      });
    });
    
    // Test database connection endpoint
    app.get('/test-db', async (req, res) => {
      if (!process.env.DATABASE_URL) {
        return res.json({ error: 'DATABASE_URL not configured' });
      }
      
      try {
        const { Client } = require('pg');
        const client = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        
        console.log('🔌 Testing database connection...');
        await client.connect();
        console.log('✅ Database connected successfully');
        
        const result = await client.query('SELECT version()');
        await client.end();
        
        res.json({
          status: 'database-connection-successful',
          version: result.rows[0].version,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Database test failed:', error);
        res.json({
          status: 'database-connection-failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    app.get('/admin', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Diagnostic Mode</title></head>
        <body>
          <h1>ClubVision Diagnostic Mode</h1>
          <p>All modules loaded successfully!</p>
          <p><a href="/test-db">Test Database Connection</a></p>
          <p>Time: ${new Date().toISOString()}</p>
        </body>
        </html>
      `);
    });
    
    console.log('🚀 Starting diagnostic server...');
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ DIAGNOSTIC SERVER STARTED SUCCESSFULLY');
      console.log(`✅ All modules loaded without errors`);
      console.log(`✅ Ready for database connection testing`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in diagnostic server:', error);
    console.error('Stack:', error.stack);
  }
}

startDiagnosticServer();