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
  
  // Query users
  queryFirestore(accessToken, 'users').then(users => {
    console.log('--- USERS ---');
    users.documents.forEach(d => {
      const fields = d.fields;
      const id = d.name.split('/').pop();
      const name = fields.name?.stringValue || id;
      const uid = fields.uid?.stringValue;
      console.log(`Document ID: "${id}" | name field: "${name}" | uid field: "${uid}"`);
    });
    process.exit(0);
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
