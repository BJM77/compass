async function run() {
  // We'll search for pipelineReviews for week 22 containing namra
  const url = 'https://firestore.googleapis.com/v1/projects/studio-5306701288-d19b1/databases/(default)/documents:runQuery';
  
  // Pipeline query
  const pipelinePayload = {
    structuredQuery: {
      from: [{ collectionId: "pipelineReviews" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "week" },
                op: "EQUAL",
                value: { stringValue: "2026-22" }
              }
            }
          ]
        }
      }
    }
  };

  try {
    console.log("Fetching pipelineReviews for week 22...");
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelinePayload)
    });
    const data = await res.json();
    
    // Process results
    const namraDocs = [];
    const otherDocs = [];
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (!item.document) return;
        const d = item.document.fields;
        const str = JSON.stringify(d).toLowerCase();
        if (str.includes('namra') || str.includes('khan') || str.includes('wahexg')) {
          namraDocs.push({
            id: item.document.name.split('/').pop(),
            userName: d.userName?.stringValue,
            userId: d.userId?.stringValue,
            value: d.value?.integerValue || d.value?.doubleValue,
            stage: d.stage?.stringValue,
            isBareAccount: d.isBareAccount?.booleanValue
          });
        }
      });
    }
    console.log("=== NAMRA PIPELINE REVIEWS (Week 22) ===");
    console.log(JSON.stringify(namraDocs, null, 2));

    // Progress query
    const progressPayload = {
      structuredQuery: {
        from: [{ collectionId: "weeklyProgress" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "week" },
                  op: "EQUAL",
                  value: { stringValue: "2026-22" }
                }
              }
            ]
          }
        }
      }
    };
    console.log("\nFetching weeklyProgress for week 22...");
    const pRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressPayload)
    });
    const pData = await pRes.json();
    const namraProgress = [];
    if (Array.isArray(pData)) {
      pData.forEach(item => {
        if (!item.document) return;
        const d = item.document.fields;
        const str = JSON.stringify(d).toLowerCase();
        if (str.includes('namra') || str.includes('khan') || str.includes('wahexg')) {
          namraProgress.push({
            id: item.document.name.split('/').pop(),
            userId: d.userId?.stringValue,
            crmCalls: d.crmCalls?.integerValue || d.crmCalls?.doubleValue,
            crmApps: d.crmApps?.integerValue || d.crmApps?.doubleValue,
            calls: d.calls?.integerValue || d.calls?.doubleValue,
            apps: d.apps?.integerValue || d.apps?.doubleValue,
          });
        }
      });
    }
    console.log("=== NAMRA PROGRESS (Week 22) ===");
    console.log(JSON.stringify(namraProgress, null, 2));

  } catch(e) {
    console.error("Error:", e);
  }
}
run();
