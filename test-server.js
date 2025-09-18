console.log('🚀 Starting minimal test server...');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('📊 Environment check:');
console.log('  - Node version:', process.version);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - PORT:', PORT);
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');

// Basic middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Minimal ClubVision Test Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with enhanced error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal test server running on 0.0.0.0:${PORT}`);
  console.log(`✅ Health check available at /health`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🎯 Minimal server setup complete');