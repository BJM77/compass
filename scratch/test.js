const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.toString() });
  });

  try {
    await page.goto('http://localhost:9003/login', { waitUntil: 'networkidle2' });
    await page.type('#email', '1@1.com');
    await page.type('#password', '123456');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log("Logged in successfully");

    // Wait 2s to let anything settle
    await new Promise(r => setTimeout(r, 2000));

    // Get all sidebar nav buttons
    let menuButtons = await page.$$('[data-sidebar="menu-button"]');
    console.log(`Found ${menuButtons.length} menu buttons`);

    for (let i = 0; i < menuButtons.length; i++) {
        // Re-query to avoid stale element errors
        let currentButtons = await page.$$('[data-sidebar="menu-button"]');
        if (!currentButtons[i]) continue;
        
        const btnText = await page.evaluate(el => el.textContent.trim(), currentButtons[i]);
        if (btnText === 'Sign Out') continue;
        if (btnText === 'Return to Governance') continue;
        
        console.log(`Clicking tab: ${btnText}`);
        await currentButtons[i].click();
        await new Promise(r => setTimeout(r, 2000)); 
        
        const subTabs = await page.$$('[role="tab"]');
        if (subTabs.length > 0) {
            console.log(`Found ${subTabs.length} sub-tabs for ${btnText}`);
            for (let j = 0; j < subTabs.length; j++) {
                let cSubTabs = await page.$$('[role="tab"]');
                if (!cSubTabs[j]) continue;
                const subBtnText = await page.evaluate(el => el.textContent.trim(), cSubTabs[j]);
                console.log(`  Clicking sub-tab: ${subBtnText}`);
                await cSubTabs[j].click();
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    
    // Output errors
    console.log("----- ERRORS CAPTURED -----");
    const firebaseErrors = errors.filter(e => e.text.includes('Firebase') || e.text.includes('permission error') || e.text.includes('Missing or insufficient permissions'));
    
    if (firebaseErrors.length > 0) {
       console.log("Found Firebase Permissions Errors:");
       const uniqueErrs = [...new Set(firebaseErrors.map(e => e.text))];
       uniqueErrs.forEach((e, idx) => console.log(`${idx+1}. ${e.substring(0, 500)}`));
    } else if (errors.length > 0) {
       console.log("Found other errors:");
       const uniqueErrs = [...new Set(errors.map(e => e.text))];
       uniqueErrs.forEach((e, idx) => console.log(`${idx+1}. ${e.substring(0, 200)}`));
    } else {
       console.log("No errors found!");
    }
  } catch (err) {
    console.error("Test Script Error:", err);
  } finally {
    await browser.close();
  }
})();
