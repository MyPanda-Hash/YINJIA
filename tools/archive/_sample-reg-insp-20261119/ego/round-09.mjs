const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto('http://127.0.0.1:8090/?logout=1#/login', { timeout: 30000 });
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  selects: [...document.querySelectorAll('.el-select')].length,
  text: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,200),
})), null, 2));
