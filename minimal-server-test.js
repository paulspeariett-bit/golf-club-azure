// minimal-server-test.js - Diagnostic version for Azure
console.log('🔍 Starting minimal diagnostic server...');
console.log('📊 Environment diagnostics:');
console.log('  - Node version:', process.version);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - PORT:', process.env.PORT || '8080 (default)');
console.log('  - Working directory:', process.cwd());

try {
  console.log('📦 Loading required modules...');
  const express = require('express');
  console.log('✅ Express loaded');
  
  const app = express();
  const PORT = process.env.PORT || 8080;
  
  console.log('⚙️  Setting up middleware...');
  app.use(express.json());
  
  console.log('🛣️  Setting up routes...');
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Minimal diagnostic server running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      port: PORT,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('🚀 Starting server...');
  
  const server = app.listen(PORT, () => {
    console.log('✅ SERVER STARTED SUCCESSFULLY');
    console.log(`✅ Listening on port ${PORT}`);
    console.log(`✅ Health check available at /health`);
  });
  
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
} catch (error) {
  console.error('❌ CRITICAL ERROR during server setup:', error);
  process.exit(1);
}

// Enhanced error handlers
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('📝 Minimal server setup complete');