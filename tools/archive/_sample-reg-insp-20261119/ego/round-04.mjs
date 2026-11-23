const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto('http://127.0.0.1:8090/', { timeout: 30000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type, value: i.value, cls: i.className })),
  selects: [...document.querySelectorAll('.el-select')].map((s) => (s.innerText || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
}));
console.log(JSON.stringify(info, null, 2));
