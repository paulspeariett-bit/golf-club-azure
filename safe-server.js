// safe-server.js - Ultra-safe version with comprehensive error catching
console.log('🚀 Starting SAFE ClubVision server...');

// Early error handlers
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  console.error('This would normally crash the process, but we are catching it');
  // Don't exit - keep server running for diagnostics
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  console.error('This would normally crash the process, but we are catching it');
  // Don't exit - keep server running for diagnostics
});

async function startSafeServer() {
  try {
    console.log('📦 Loading modules with error handling...');
    
    const express = require('express');
    console.log('✅ Express loaded');
    
    const cors = require('cors');
    console.log('✅ CORS loaded');
    
    const path = require('path');
    console.log('✅ Path loaded');
    
    const app = express();
    const PORT = process.env.PORT || 8080;
    
    console.log('⚙️  Setting up middleware...');
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    console.log('🛣️  Setting up safe routes...');
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'safe-server-ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: 'safe-mode'
      });
    });
    
    // Root endpoint
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Safe ClubVision server running',
        status: 'operational',
        mode: 'safe-diagnostic',
        timestamp: new Date().toISOString()
      });
    });
    
    // Admin endpoint (static response for now)
    app.get('/admin', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Safe Mode - ClubVision</title>
        </head>
        <body>
          <h1>ClubVision Safe Mode</h1>
          <p>Server is running in safe diagnostic mode.</p>
          <p>Time: ${new Date().toISOString()}</p>
          <p>This confirms the server can start and respond.</p>
        </body>
        </html>
      `);
    });
    
    // Catch-all route
    app.use('*', (req, res) => {
      res.json({
        message: 'Safe server catch-all',
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('🚀 Starting safe server...');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ SAFE SERVER STARTED SUCCESSFULLY');
      console.log(`✅ Listening on 0.0.0.0:${PORT}`);
      console.log('✅ Server is stable and responding');
    });
    
    server.on('error', (error) => {
      console.error('❌ Safe server error:', error);
      console.error('Error code:', error.code);
      console.error('Stack:', error.stack);
    });
    
    // Keep the process alive
    setInterval(() => {
      console.log(`⚡ Safe server heartbeat - uptime: ${process.uptime().toFixed(1)}s`);
    }, 30000); // Every 30 seconds
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in safe server setup:', error);
    console.error('Stack:', error.stack);
    console.error('Attempting to continue anyway...');
    
    // Try to start a minimal server even if there's an error
    try {
      const express = require('express');
      const app = express();
      app.get('*', (req, res) => res.send('Emergency server mode'));
      app.listen(process.env.PORT || 8080, '0.0.0.0', () => {
        console.log('🆘 Emergency server started');
      });
    } catch (emergencyError) {
      console.error('❌ Even emergency server failed:', emergencyError);
    }
  }
}

console.log('🔧 Starting safe server initialization...');
startSafeServer();

console.log('📝 Safe server script completed');