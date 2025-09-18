// Ultra Debug Server - Maximum logging to find Azure crash cause
console.log('🔍 ULTRA DEBUG SERVER STARTING');
console.log('🕐 Start Time:', new Date().toISOString());
console.log('📍 Node Version:', process.version);
console.log('🖥️  Platform:', process.platform);
console.log('🏗️  Architecture:', process.arch);

// Log every single thing that happens
let logCounter = 0;
function debugLog(message, data = '') {
  logCounter++;
  console.log(`[${logCounter}] ${new Date().toISOString()} - ${message}`, data);
}

debugLog('Process starting up');
debugLog('Working directory', process.cwd());
debugLog('__dirname', __dirname);
debugLog('Memory usage', JSON.stringify(process.memoryUsage()));

// Monitor memory every 5 seconds
const memoryInterval = setInterval(() => {
  debugLog('Memory check', JSON.stringify(process.memoryUsage()));
}, 5000);

debugLog('About to require http module');
const http = require('http');
debugLog('✅ http module loaded');

debugLog('About to require util module');  
const util = require('util');
debugLog('✅ util module loaded');

const PORT = process.env.PORT || 8080;
debugLog('Port configured', PORT);

debugLog('About to create server');
const server = http.createServer((req, res) => {
  debugLog('📥 Incoming request', `${req.method} ${req.url}`);
  
  // Super fast response
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  const response = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    counter: logCounter,
    memory: process.memoryUsage().rss,
    url: req.url
  };
  
  res.end(JSON.stringify(response));
  debugLog('📤 Response sent', `Status 200 for ${req.url}`);
});

debugLog('✅ Server created');

// Enhanced error handling with extreme detail
server.on('error', (error) => {
  debugLog('❌ SERVER ERROR detected');
  debugLog('❌ Error name', error.name);
  debugLog('❌ Error message', error.message);
  debugLog('❌ Error code', error.code);
  debugLog('❌ Error stack', error.stack);
  debugLog('❌ Error toString', error.toString());
  
  clearInterval(memoryInterval);
  debugLog('💀 Exiting due to server error');
  process.exit(1);
});

server.on('listening', () => {
  const addr = server.address();
  debugLog('✅ SERVER LISTENING');
  debugLog('✅ Address', addr.address);
  debugLog('✅ Port', addr.port);
  debugLog('✅ Family', addr.family);
  debugLog('✅ Process PID', process.pid);
  debugLog('✅ Ready to serve requests');
});

server.on('connection', (socket) => {
  debugLog('🔗 New connection', `from ${socket.remoteAddress}:${socket.remotePort}`);
});

server.on('close', () => {
  debugLog('🚪 Server closed');
  clearInterval(memoryInterval);
});

// Process event handlers with extreme logging
process.on('exit', (code) => {
  debugLog('🚪 PROCESS EXIT', `code: ${code}`);
  clearInterval(memoryInterval);
});

process.on('SIGTERM', (signal) => {
  debugLog('📥 SIGTERM received', signal);
  clearInterval(memoryInterval);
  debugLog('🚪 Graceful shutdown from SIGTERM');
  server.close(() => {
    debugLog('✅ Server closed gracefully from SIGTERM');
    process.exit(0);
  });
});

process.on('SIGINT', (signal) => {
  debugLog('📥 SIGINT received', signal);
  clearInterval(memoryInterval);
  debugLog('🚪 Graceful shutdown from SIGINT');
  server.close(() => {
    debugLog('✅ Server closed gracefully from SIGINT');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  debugLog('❌ UNCAUGHT EXCEPTION detected');
  debugLog('❌ Exception name', error.name);
  debugLog('❌ Exception message', error.message);
  debugLog('❌ Exception stack', error.stack);
  debugLog('❌ Exception toString', error.toString());
  clearInterval(memoryInterval);
  debugLog('💀 Exiting due to uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog('❌ UNHANDLED REJECTION detected');
  debugLog('❌ Rejection reason', reason);
  debugLog('❌ Rejection promise', util.inspect(promise));
  clearInterval(memoryInterval);
  debugLog('💀 Exiting due to unhandled rejection');
  process.exit(1);
});

process.on('warning', (warning) => {
  debugLog('⚠️  Process warning', warning.name);
  debugLog('⚠️  Warning message', warning.message);
  debugLog('⚠️  Warning stack', warning.stack);
});

// Log all environment variables (safely)
debugLog('📋 Environment variables:');
Object.keys(process.env)
  .filter(key => !key.toLowerCase().includes('secret') && !key.toLowerCase().includes('password'))
  .sort()
  .slice(0, 20) // First 20 to avoid spam
  .forEach(key => {
    debugLog(`  ${key}`, process.env[key]);
  });

debugLog('🚀 About to start listening');
debugLog('🚀 Binding to', `0.0.0.0:${PORT}`);

try {
  server.listen(PORT, '0.0.0.0', () => {
    debugLog('🎉 LISTEN SUCCESS');
    debugLog('🎉 Server is now accepting connections');
  });
} catch (listenError) {
  debugLog('❌ LISTEN ERROR', listenError.message);
  debugLog('❌ Listen error stack', listenError.stack);
  clearInterval(memoryInterval);
  process.exit(1);
}

debugLog('🔚 End of script reached');
debugLog('⏰ Waiting for events...');