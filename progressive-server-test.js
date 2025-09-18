// progressive-server-test.js - Gradually add back functionality to isolate the issue
console.log('🔍 Starting progressive diagnostic server...');
console.log('📊 Environment diagnostics:');
console.log('  - Node version:', process.version);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - PORT:', process.env.PORT || '8080 (default)');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');

// Global error handlers (same as main server)
process.on('uncaughtException', err => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  // Don't exit in production to prevent container restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', err => {
  console.error('❌ UNHANDLED REJECTION:', err);
  // Don't exit in production to prevent container restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

async function startProgressiveServer() {
  try {
    console.log('📦 Loading basic modules...');
    const express = require('express');
    const cors = require('cors');
    const path = require('path');
    console.log('✅ Basic modules loaded');
    
    const app = express();
    const PORT = process.env.PORT || 8080;
    
    console.log('⚙️  Setting up middleware...');
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    console.log('✅ Basic middleware configured');
    
    console.log('🛣️  Setting up basic routes...');
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Progressive diagnostic server - basic functionality',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stage: 'basic'
      });
    });
    
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok',
        env: process.env.NODE_ENV || 'development',
        port: PORT,
        timestamp: new Date().toISOString(),
        stage: 'basic'
      });
    });

    console.log('🔑 Testing advanced modules...');
    
    // Test each module that could cause issues
    try {
      const bcrypt = require('bcrypt');
      console.log('✅ bcrypt loaded');
    } catch (e) {
      console.error('❌ bcrypt failed:', e.message);
    }
    
    try {
      const jwt = require('jsonwebtoken');
      console.log('✅ jwt loaded');
    } catch (e) {
      console.error('❌ jwt failed:', e.message);
    }
    
    try {
      const { Client } = require('pg');
      console.log('✅ pg loaded');
    } catch (e) {
      console.error('❌ pg failed:', e.message);
    }
    
    try {
      const session = require('express-session');
      console.log('✅ express-session loaded');
    } catch (e) {
      console.error('❌ express-session failed:', e.message);
    }
    
    try {
      const passport = require('passport');
      const LocalStrategy = require('passport-local').Strategy;
      console.log('✅ passport and LocalStrategy loaded');
    } catch (e) {
      console.error('❌ passport failed:', e.message);
    }

    console.log('🚀 Starting server...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ PROGRESSIVE SERVER STARTED SUCCESSFULLY');
      console.log(`✅ Listening on 0.0.0.0:${PORT}`);
      console.log('✅ All basic modules loaded successfully');
    });
    
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR during progressive server setup:', error);
    console.error('Stack:', error.stack);
  }
}

startProgressiveServer();