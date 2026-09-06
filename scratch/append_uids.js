const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    initializeApp({
      projectId: 'studio-5306701288-d19b1'
    });
    
    const db = getFirestore();
    const snap = await db.collection('users').get();
    
    let output = '\n=========================================\n';
    output += 'USER UIDS AND ROLES\n';
    output += '=========================================\n\n';
    
    const roles = ['BDM', 'ACCOUNT_MANAGER', 'AM', 'GM', 'LEADER', 'SUPER_ADMIN'];
    
    let userList = [];
    snap.forEach(doc => {
      const data = doc.data();
      const roleStr = typeof data.role === 'string' ? data.role.toUpperCase() : '';
      if (roleStr && roles.includes(roleStr)) {
        userList.push({
          id: doc.id,
          name: data.name || data.displayName || 'Unknown',
          email: data.email || 'N/A',
          role: data.role
        });
      }
    });

    userList.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
    
    for (const u of userList) {
      output += `Role: ${u.role}\nName: ${u.name}\nEmail: ${u.email}\nUID: ${u.id}\n-------------------------\n`;
    }
    
    const outputFile = path.join(process.cwd(), 'all_code_backup.txt');
    fs.appendFileSync(outputFile, output, 'utf8');
    
    console.log(`Successfully appended ${userList.length} users to the backup.`);
  } catch(e) {
    console.error("Failed:", e);
  }
}

run();
