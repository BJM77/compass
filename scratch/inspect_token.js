const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(require('os').homedir(), '.config/configstore/firebase-tools.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accessToken = config.tokens?.access_token;
  
  if (!accessToken) {
    console.error('No access token found in firebase-tools.json');
    process.exit(1);
  }
  
  const targetWeeks = ['2026-21', '2026-20', '2026-19', '2026-18'];
  console.log('Target Weeks:', targetWeeks);
  
  // Query users
  queryFirestore(accessToken, 'users').then(users => {
    const userMap = new Map();
    users.documents.forEach(d => {
      const fields = d.fields;
      const id = d.name.split('/').pop();
      const name = fields.name?.stringValue || id;
      userMap.set(id, name);
    });
    
    // Query weeklyProgress
    queryFirestore(accessToken, 'weeklyProgress').then(progress => {
      console.log('\n--- TARGET WEEKS PROGRESS ---');
      if (!progress.documents) {
        console.log('No documents found.');
        process.exit(0);
      }
      progress.documents.forEach(d => {
        const fields = d.fields;
        const userId = fields.userId?.stringValue;
        const week = fields.week?.stringValue;
        if (targetWeeks.includes(week)) {
          const calls = fields.calls?.integerValue || fields.crmCalls?.integerValue || 0;
          const apps = fields.apps?.integerValue || fields.crmApps?.integerValue || 0;
          const crmCalls = fields.crmCalls?.integerValue || 0;
          const crmApps = fields.crmApps?.integerValue || 0;
          const userName = userMap.get(userId) || `Unknown (${userId})`;
          console.log(`User: ${userName} | Week: ${week} | Calls: ${calls} | Apps: ${apps} | crmCalls: ${crmCalls} | crmApps: ${crmApps}`);
        }
      });
      process.exit(0);
    });
  });
} catch (e) {
  console.error('Error:', e);
}

function queryFirestore(token, collection) {
  return new Promise((resolve, reject) => {
    const projectId = 'studio-5306701288-d19b1';
    const path = `/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=300`;
    
    https.get({
      hostname: 'firestore.googleapis.com',
      path: path,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}
