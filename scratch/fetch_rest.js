const fs = require('fs');

async function fetchAll(collection) {
  let url = `https://firestore.googleapis.com/v1/projects/studio-5306701288-d19b1/databases/(default)/documents/${collection}?key=AIzaSyD8eWxEjK57tndLBXYFxGCswYF47aHo080&pageSize=1000`;
  let allDocs = [];
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.documents) {
      allDocs = allDocs.concat(data.documents);
    }
    if (data.nextPageToken) {
      url = `https://firestore.googleapis.com/v1/projects/studio-5306701288-d19b1/databases/(default)/documents/${collection}?key=AIzaSyD8eWxEjK57tndLBXYFxGCswYF47aHo080&pageSize=1000&pageToken=${data.nextPageToken}`;
    } else {
      url = null;
    }
  }
  return allDocs;
}

async function run() {
  const users = await fetchAll('users');
  const namras = users.filter(u => JSON.stringify(u).toLowerCase().includes('namra') || JSON.stringify(u).toLowerCase().includes('kahn') || JSON.stringify(u).toLowerCase().includes('khan'));
  console.log("Users:", JSON.stringify(namras, null, 2));

  const pipelines = await fetchAll('pipelineReviews');
  const namraP = pipelines.filter(u => JSON.stringify(u).toLowerCase().includes('namra') || JSON.stringify(u).toLowerCase().includes('kahn') || JSON.stringify(u).toLowerCase().includes('khan'));
  console.log("Pipeline Reviews:", namraP.map(p => ({
    name: p.name,
    userId: p.fields.userId?.stringValue,
    userName: p.fields.userName?.stringValue
  })));
}
run();
