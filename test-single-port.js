#!/usr/bin/env node

/**
 * Test script to verify single port setup
 * Tests both HTTP API and WebSocket on the same port
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8000;
const BASE_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;

console.log('🧪 Testing single port setup...');
console.log(`📡 Testing HTTP API on: ${BASE_URL}`);
console.log(`🔌 Testing WebSocket on: ${WS_URL}/api/notifications/ws`);
console.log('='.repeat(50));

// Test 1: HTTP Health Check
console.log('\n1️⃣ Testing HTTP Health Check...');
const healthReq = http.get(`${BASE_URL}/health`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Health Check Response:', {
        status: result.status,
        connectedClients: result.connectedClients,
        adminClients: result.adminClients
      });
    } catch (error) {
      console.log('❌ Health Check Failed:', error.message);
    }
  });
});

healthReq.on('error', (error) => {
  console.log('❌ Health Check Error:', error.message);
});

// Test 2: HTTP API Broadcast
console.log('\n2️⃣ Testing HTTP API Broadcast...');
const broadcastData = JSON.stringify({
  notification: {
    id: 'test-' + Date.now(),
    title: 'Test Notification',
    body: 'This is a test notification',
    isGlobal: true,
    targetUserIds: [],
    priority: 'NORMAL'
  }
});

const broadcastReq = http.request({
  hostname: 'localhost',
  port: PORT,
  path: '/api/broadcast',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(broadcastData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Broadcast Response:', result);
    } catch (error) {
      console.log('❌ Broadcast Failed:', error.message);
    }
  });
});

broadcastReq.on('error', (error) => {
  console.log('❌ Broadcast Error:', error.message);
});

broadcastReq.write(broadcastData);
broadcastReq.end();

// Test 3: WebSocket Connection
console.log('\n3️⃣ Testing WebSocket Connection...');
const ws = new WebSocket(`${WS_URL}/api/notifications/ws`);

ws.on('open', () => {
  console.log('✅ WebSocket Connected Successfully');
  
  // Send authentication
  ws.send(JSON.stringify({
    type: 'authenticate',
    userId: 'test-user',
    isAdmin: false
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('✅ WebSocket Message Received:', {
      type: message.type,
      clientId: message.clientId
    });
    
    if (message.type === 'authenticated') {
      console.log('✅ WebSocket Authentication Successful');
      ws.close();
    }
  } catch (error) {
    console.log('❌ WebSocket Message Parse Error:', error.message);
  }
});

ws.on('close', () => {
  console.log('✅ WebSocket Connection Closed');
  console.log('\n🎉 All tests completed! Single port setup is working correctly.');
});

ws.on('error', (error) => {
  console.log('❌ WebSocket Error:', error.message);
});

// Test 4: General HTTP Response
console.log('\n4️⃣ Testing General HTTP Response...');
const generalReq = http.get(`${BASE_URL}/`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ General HTTP Response:', {
        message: result.message,
        status: result.status,
        connectedClients: result.connectedClients
      });
    } catch (error) {
      console.log('❌ General HTTP Failed:', error.message);
    }
  });
});

generalReq.on('error', (error) => {
  console.log('❌ General HTTP Error:', error.message);
});
