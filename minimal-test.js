// Test server with minimal routes and no middleware dependencies
console.log('🚀 Starting minimal Azure test...');

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Essential health routes (Azure needs these)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    pid: process.pid,
    node: process.version,
    time: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'ClubVision Test Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Direct route for admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running on 0.0.0.0:${PORT}`);
  console.log(`✅ Health endpoints available at /health and /healthz`);
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
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🎯 Minimal test server ready');