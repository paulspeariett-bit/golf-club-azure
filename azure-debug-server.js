// Ultra-minimal server for Azure debugging
console.log('=== AZURE DEBUG SERVER ===');
console.log('Node version:', process.version);
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Test if basic express works
try {
  const express = require('express');
  console.log('EXPRESS: OK');
  
  const app = express();
  console.log('APP CREATED: OK');
  
  const PORT = process.env.PORT || 8080;
  
  app.get('/', (req, res) => {
    res.json({ status: 'ALIVE', timestamp: new Date().toISOString() });
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
  });
  
  console.log('ROUTES SETUP: OK');
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER STARTED ON PORT:', PORT);
    console.log('SERVER LISTENING: OK');
  });
  
  server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
  });
  
} catch (error) {
  console.error('STARTUP ERROR:', error.message);
  console.error('ERROR STACK:', error.stack);
  process.exit(1);
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error.message);
  console.error('STACK:', error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

console.log('=== SETUP COMPLETE ===');