// ultra-minimal-server.js - Absolutely minimal server to ensure startup
console.log('🚀 Starting ULTRA-MINIMAL server...');

// Minimal error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

try {
  console.log('Loading express...');
  const express = require('express');
  console.log('Express loaded');
  
  const app = express();
  const PORT = process.env.PORT || 8080;
  
  console.log('Setting up routes...');
  
  // Minimal middleware
  app.use(express.json());
  
  // Ultra simple routes
  app.get('/', (req, res) => {
    res.send('ULTRA-MINIMAL SERVER RUNNING OK');
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ultra-minimal-ok', time: new Date().toISOString() });
  });
  
  app.get('/admin', (req, res) => {
    res.send(`
      <html>
        <head><title>Ultra Minimal</title></head>
        <body>
          <h1>Ultra Minimal Server</h1>
          <p>Server is running: ${new Date().toISOString()}</p>
          <p>This proves basic functionality works</p>
        </body>
      </html>
    `);
  });
  
  // Catch all
  app.use('*', (req, res) => {
    res.send('Ultra minimal catch-all route');
  });
  
  console.log('Starting server...');
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ULTRA-MINIMAL SERVER SUCCESS - PORT ${PORT}`);
    console.log('Server is alive and responding');
  });
  
  server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
  });
  
} catch (error) {
  console.error('CRITICAL ERROR:', error);
  console.error('Stack:', error.stack);
  
  // Last resort - try to start something
  try {
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('EMERGENCY SERVER RUNNING');
    });
    server.listen(process.env.PORT || 8080, '0.0.0.0');
    console.log('EMERGENCY HTTP SERVER STARTED');
  } catch (emergencyError) {
    console.error('EVEN EMERGENCY SERVER FAILED:', emergencyError);
  }
}