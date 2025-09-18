// Azure-specific health server - designed for Azure App Service startup probe
console.log('🏥 Starting Azure Health Server...');
console.log('📅 Timestamp:', new Date().toISOString());
console.log('🏷️  Node version:', process.version);

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Track server startup time
const startTime = Date.now();

// Middleware - minimal and fast
app.use(express.json({ limit: '1mb' }));

// Azure health check endpoints - multiple variations
app.get('/health', (req, res) => {
  const uptime = Date.now() - startTime;
  console.log(`🏥 Health check at ${new Date().toISOString()}, uptime: ${uptime}ms`);
  res.status(200).json({
    status: 'healthy',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    port: PORT,
    ready: true
  });
});

app.get('/healthz', (req, res) => {
  const uptime = Date.now() - startTime;
  console.log(`🏥 Healthz check at ${new Date().toISOString()}, uptime: ${uptime}ms`);
  res.status(200).json({
    status: 'ok',
    ready: true,
    uptime: uptime
  });
});

// Azure-specific probe endpoint
app.get('/api/health', (req, res) => {
  const uptime = Date.now() - startTime;
  console.log(`🏥 API health check at ${new Date().toISOString()}, uptime: ${uptime}ms`);
  res.status(200).json({
    status: 'running',
    service: 'golf-club-azure',
    ready: true,
    uptime: uptime
  });
});

// Root endpoint - Azure sometimes probes this
app.get('/', (req, res) => {
  const uptime = Date.now() - startTime;
  console.log(`🏠 Root access at ${new Date().toISOString()}, uptime: ${uptime}ms`);
  res.status(200).json({
    message: 'Golf Club Azure Service',
    status: 'running',
    ready: true,
    uptime: uptime,
    timestamp: new Date().toISOString()
  });
});

// Log all requests to help debug Azure's probe behavior
app.use('*', (req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} from ${req.ip}`);
  console.log(`📝 Headers:`, JSON.stringify(req.headers, null, 2));
  next();
});

// Catch-all for unmatched routes
app.use('*', (req, res) => {
  console.log(`❓ Unknown route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Process error handlers
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('❌ Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('❌ Promise:', promise);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📥 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📥 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced logging
const server = app.listen(PORT, '0.0.0.0', () => {
  const actualPort = server.address().port;
  console.log('✅ AZURE HEALTH SERVER STARTED');
  console.log(`✅ Listening on 0.0.0.0:${actualPort}`);
  console.log(`✅ Process ID: ${process.pid}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ Ready to receive Azure health probes`);
  console.log(`✅ Health endpoints: /health, /healthz, /api/health, /`);
  console.log(`✅ Server startup completed in ${Date.now() - startTime}ms`);
});

server.on('error', (error) => {
  console.error('❌ SERVER ERROR:', error);
  console.error('❌ Error code:', error.code);
  console.error('❌ Error message:', error.message);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  process.exit(1);
});

server.on('connection', (socket) => {
  console.log(`🔗 New connection from ${socket.remoteAddress}:${socket.remotePort}`);
});

// Keep server alive with periodic logging
setInterval(() => {
  const uptime = Date.now() - startTime;
  console.log(`💓 Server heartbeat - uptime: ${uptime}ms, memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
}, 10000); // Every 10 seconds

console.log('🚀 Azure Health Server initialization complete');