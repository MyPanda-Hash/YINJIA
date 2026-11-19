const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/login', { timeout: 30000 });
await page.waitForTimeout(2500);
const dump = () => page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    hash: location.hash,
    ins: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', v: i.value, type: i.type })),
    selects: [...document.querySelectorAll('.el-select')].map((s) => txt(s)),
    btns: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 10),
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    ls: Object.fromEntries(Object.keys(localStorage).filter((k) => /factory|ledger|db|login/i.test(k)).map((k) => [k, localStorage.getItem(k)])),
  };
});
console.log(JSON.stringify(await dump(), null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-03-login.png' });
console.log({ screenshot: shot });
