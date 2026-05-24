const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => a.toString())));
      errors.push({ type: 'console', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') });
    }
  });

  try {
    await page.goto('http://localhost:9003/login', { waitUntil: 'networkidle2' });
    await page.type('#email', '1@1.com');
    await page.type('#password', '123456');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await new Promise(r => setTimeout(r, 2000));

    let menuButtons = await page.$$('[data-sidebar="menu-button"]');
    for (let i = 0; i < menuButtons.length; i++) {
        let currentButtons = await page.$$('[data-sidebar="menu-button"]');
        if (!currentButtons[i]) continue;
        
        const btnText = await page.evaluate(el => el.textContent.trim(), currentButtons[i]);
        if (btnText === 'Sign Out' || btnText === 'Return to Governance') continue;
        
        await currentButtons[i].click();
        await new Promise(r => setTimeout(r, 2000)); 
        
        const subTabs = await page.$$('[role="tab"]');
        if (subTabs.length > 0) {
            for (let j = 0; j < subTabs.length; j++) {
                let cSubTabs = await page.$$('[role="tab"]');
                if (!cSubTabs[j]) continue;
                await cSubTabs[j].click();
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    
    console.log("----- ERRORS CAPTURED -----");
    const firebaseErrors = errors.filter(e => e.text.includes('Firebase') || e.text.includes('permission') || e.text.includes('Firestore'));
    
    if (firebaseErrors.length > 0) {
       console.log("Found Firebase Permissions Errors:");
       const uniqueErrs = [...new Set(firebaseErrors.map(e => e.text))];
       uniqueErrs.forEach((e, idx) => console.log(`${idx+1}. ${e}`));
    } else {
       console.log("No Firebase errors found!");
    }
  } catch (err) {
    console.error("Test Script Error:", err);
  } finally {
    await browser.close();
  }
})();
