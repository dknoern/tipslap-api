#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');

// Use a different port for testing
const TEST_PORT = 3001;
process.env.PORT = TEST_PORT;

// Start the server
console.log(`Starting server on port ${TEST_PORT}...`);
const server = spawn('npm', ['start'], { 
  stdio: 'pipe',
  env: { ...process.env, PORT: TEST_PORT }
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  if (output.includes('Tipslap API server running')) {
    serverReady = true;
    console.log('Server started successfully!');
    
    // Test health endpoint
    setTimeout(() => {
      console.log('Testing health endpoint...');
      const req = http.get(`http://localhost:${TEST_PORT}/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('Health check response:', JSON.parse(data));
          console.log('✅ Setup verification complete!');
          server.kill();
          process.exit(0);
        });
      });
      
      req.on('error', (err) => {
        console.error('❌ Health check failed:', err.message);
        server.kill();
        process.exit(1);
      });
    }, 1000);
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  if (!serverReady) {
    console.error('❌ Server failed to start');
    process.exit(1);
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!serverReady) {
    console.error('❌ Server startup timeout');
    server.kill();
    process.exit(1);
  }
}, 10000);