const fs = require('fs');
const path = require('path');

const configPath = path.join(require('os').homedir(), '.config/configstore/firebase-tools.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Keys of config:', Object.keys(config));
  if (config.tokens) {
    console.log('Keys of config.tokens:', Object.keys(config.tokens));
    const tokenObj = config.tokens.activeAccount;
    if (tokenObj) {
      console.log('Keys of activeAccount:', Object.keys(tokenObj));
      console.log('Access token starts with:', tokenObj.accessToken?.substring(0, 10));
    }
  }
} catch (e) {
  console.error(e);
}
