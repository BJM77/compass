const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
  try {
    initializeApp({ projectId: 'studio-5306701288-d19b1' });
    const db = getFirestore();
    
    // 1. Fetch Users containing 'namra' or 'khan' in name or email
    const usersSnap = await db.collection('users').get();
    const namraUsers = usersSnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(u => {
            const str = JSON.stringify(u).toLowerCase();
            return str.includes('namra');
        });
        
    console.log("=== USERS ===");
    console.log(JSON.stringify(namraUsers, null, 2));
    
    // 2. Fetch Pipeline Reviews containing 'namra'
    const pipelineSnap = await db.collection('pipelineReviews').get();
    const namraPipelines = pipelineSnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(u => {
            const str = JSON.stringify(u).toLowerCase();
            return str.includes('namra');
        });
        
    console.log(`\n=== PIPELINE REVIEWS (Total: ${namraPipelines.length}) ===`);
    // Group pipelines by userId
    const pipeGroup = {};
    namraPipelines.forEach(p => {
        if (!pipeGroup[p.userId]) pipeGroup[p.userId] = { count: 0, sample: p };
        pipeGroup[p.userId].count++;
    });
    console.log(JSON.stringify(pipeGroup, null, 2));
    
    // 3. Fetch Historical / Weekly Data containing 'namra'
    const weeklySnap = await db.collection('weeklyReports').get();
    const namraWeekly = weeklySnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(u => {
            const str = JSON.stringify(u).toLowerCase();
            return str.includes('namra');
        });
    console.log(`\n=== WEEKLY REPORTS (Total: ${namraWeekly.length}) ===`);
    
    const weeklyProgressSnap = await db.collection('weeklyProgress').get();
    const namraProgress = weeklyProgressSnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(u => {
            const str = JSON.stringify(u).toLowerCase();
            return str.includes('namra');
        });
    console.log(`\n=== WEEKLY PROGRESS (Total: ${namraProgress.length}) ===`);
    
    const commitmentsSnap = await db.collection('weeklyCommitments').get();
    const namraCommitments = commitmentsSnap.docs
        .map(d => ({id: d.id, ...d.data()}))
        .filter(u => {
            const str = JSON.stringify(u).toLowerCase();
            return str.includes('namra');
        });
    console.log(`\n=== WEEKLY COMMITMENTS (Total: ${namraCommitments.length}) ===`);
    
    console.log(`\nCommitments Grouped by User:`);
    const commitGroup = {};
    namraCommitments.forEach(c => {
        const u = c.userId || c.userName || 'unknown';
        if(!commitGroup[u]) commitGroup[u] = { count: 0, ids: [] };
        commitGroup[u].count++;
        commitGroup[u].ids.push(c.id);
    });
    console.log(JSON.stringify(commitGroup, null, 2));

  } catch(e) {
    console.error("Error:", e);
  }
}
run();
