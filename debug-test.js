#!/usr/bin/env node

// Debug script to test Pi-hole API authentication
// Usage: node --env-file=.env debug-test.js
import axios from 'axios';

async function testPiHoleAuth() {
  const baseUrl = process.env.PIHOLE_BASE_URL || process.env.PIHOLE_URL || "http://pihole.local";
  const password = process.env.PIHOLE_PASSWORD || process.env.PIHOLE_API_KEY || process.env.PIHOLE_TOKEN;
  
  console.log("Testing Pi-hole authentication...");
  console.log("Base URL:", baseUrl);
  console.log("Password provided:", !!password);
  
  if (!password) {
    console.log("No password provided. Trying without authentication...");
    try {
      const response = await axios.get(`${baseUrl}/api/stats/summary`);
      console.log("Success without auth:", response.data);
      return;
    } catch (error) {
      console.log("Failed without auth:", error.response?.status, error.response?.data);
    }
  }
  
  // Try authentication
  try {
    console.log("\nTrying authentication...");
    const authResponse = await axios.post(`${baseUrl}/api/auth`, {
      password: password
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Auth response:", authResponse.data);
    
    if (authResponse.data && authResponse.data.session && authResponse.data.session.sid) {
      const sessionId = authResponse.data.session.sid;
      console.log("Session ID obtained:", sessionId.substring(0, 8) + "...");
      
      // Try the summary endpoint with authentication
      console.log("\nTrying summary with authentication...");
      const summaryResponse = await axios.get(`${baseUrl}/api/stats/summary`, {
        headers: {
          'Content-Type': 'application/json',
          'X-FTL-SID': sessionId
        }
      });
      
      console.log("Summary success:", summaryResponse.data);
    } else {
      console.log("No session ID in auth response");
    }
    
  } catch (error) {
    console.log("Auth error:", error.response?.status, error.response?.data);
  }
}

testPiHoleAuth().catch(console.error);
