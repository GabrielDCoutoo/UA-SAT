// debug-tinygs-api.js - Investigar o que a API retorna
const axios = require('axios');

async function debugAPI() {
  console.log('🔍 TinyGS API Debug Tool\n');
  
  const endpoints = [
    'https://api.tinygs.com/v1/packets?limit=10',
    'https://api.tinygs.com/v1/packets/recent?limit=10',
    'https://api.tinygs.com/v1/packets',
    'https://api.tinygs.com/packets?limit=10',
    'https://tinygs.com/api/v1/packets?limit=10',
    'https://tinygs.com/api/packets?limit=10',
  ];
  
  for (const url of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(60));
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GroundStationBot/1.0)',
          'Accept': 'application/json'
        },
        validateStatus: () => true // Accept any status
      });
      
      console.log(`✅ Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      console.log(`   Content-Length: ${response.headers['content-length'] || 'N/A'}`);
      
      // Check response type
      const contentType = response.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        console.log(`   Format: JSON`);
        
        // Check data structure
        const data = response.data;
        const dataType = Array.isArray(data) ? 'Array' : typeof data;
        console.log(`   Type: ${dataType}`);
        
        if (Array.isArray(data)) {
          console.log(`   Length: ${data.length}`);
          
          if (data.length > 0) {
            console.log(`\n   ✅ SUCCESS! Found ${data.length} packets!\n`);
            console.log('   First packet structure:');
            console.log('   ' + JSON.stringify(data[0], null, 2).split('\n').join('\n   '));
            
            // List all keys
            console.log(`\n   Available keys: ${Object.keys(data[0]).join(', ')}`);
            
            // Show first 3 packets summary
            console.log('\n   First 3 packets:');
            data.slice(0, 3).forEach((p, i) => {
              console.log(`   ${i + 1}. Satellite: ${p.satellite || p.sat || p.satName || 'UNKNOWN'}`);
              console.log(`      Station: ${p.station || p.stationId || p.groundstation || 'UNKNOWN'}`);
              console.log(`      RSSI: ${p.rssi || 'N/A'}`);
            });
            
            return; // Stop here, we found it!
            
          } else {
            console.log('   ⚠️  Empty array');
          }
          
        } else if (typeof data === 'object') {
          console.log(`   Keys: ${Object.keys(data).join(', ')}`);
          
          // Check if data is wrapped
          if (data.packets) {
            console.log(`   ✅ Found nested packets! Count: ${data.packets.length}`);
            console.log('\n   First packet:');
            console.log('   ' + JSON.stringify(data.packets[0], null, 2).split('\n').join('\n   '));
            return;
          }
          
          if (data.data) {
            console.log(`   ✅ Found nested data! Type: ${Array.isArray(data.data) ? 'Array' : 'Object'}`);
            if (Array.isArray(data.data)) {
              console.log(`   Count: ${data.data.length}`);
              if (data.data.length > 0) {
                console.log('\n   First item:');
                console.log('   ' + JSON.stringify(data.data[0], null, 2).split('\n').join('\n   '));
                return;
              }
            }
          }
          
          console.log('\n   Raw response:');
          console.log('   ' + JSON.stringify(data, null, 2).substring(0, 500).split('\n').join('\n   '));
        }
        
      } else if (contentType.includes('text/html')) {
        console.log(`   Format: HTML`);
        console.log(`   ⚠️  Returned HTML instead of JSON`);
        console.log(`   (API may require authentication or endpoint is wrong)`);
        
        // Check if it's an error page
        const html = response.data.toString().substring(0, 500);
        if (html.includes('404') || html.includes('Not Found')) {
          console.log(`   ❌ 404 - Endpoint does not exist`);
        } else if (html.includes('401') || html.includes('Unauthorized')) {
          console.log(`   ❌ 401 - Authentication required`);
        } else {
          console.log(`   First 200 chars: ${html.substring(0, 200)}`);
        }
        
      } else {
        console.log(`   Format: Unknown (${contentType})`);
        console.log(`   First 200 chars: ${response.data.toString().substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('='.repeat(60));
  console.log('❌ No working endpoint found that returns packets');
  console.log('\nPossible reasons:');
  console.log('1. API requires authentication (API key/token)');
  console.log('2. API endpoints have changed');
  console.log('3. Rate limiting is active');
  console.log('4. API is not publicly accessible\n');
  
  console.log('NEXT STEPS:');
  console.log('1. Check TinyGS documentation: https://github.com/G4lile0/tinyGS/wiki');
  console.log('2. Try with authentication if available');
  console.log('3. Use web scraping as alternative');
  console.log('4. Contact TinyGS for API access\n');
}

debugAPI().catch(err => {
  console.error('Fatal error:', err.message);
});