const fs = await import('node:fs/promises');
const cfg = JSON.parse(await fs.readFile('D:/workspace/yinjia/_scratch/b46/ego/next.json', 'utf8'));
const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const base = 'http://localhost:5173/#/panelx/list/RD_PROD_INFO';
if (cfg.repairNo) {
  await page.goto(base + '?docNo=' + encodeURIComponent(cfg.repairNo), { timeout: 30000 });
  await page.reload({ timeout: 30000 });
} else {
  await page.goto(base + '?new=' + Date.now(), { timeout: 30000 });
  await page.reload({ timeout: 30000 });
}
await page.waitForTimeout(7000);
const before = await page.evaluate(() => ({
  hash: location.hash,
  code: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const i = td && td.nextElementSibling.querySelector('input'); return i ? i.value : null; })(),
  topic: (document.querySelector('td.rs-topic-cell input') || {}).value,
  date: (() => { const d = [...document.querySelectorAll('td.rs-info-value')][1]; const i = d && d.querySelector('input'); return i ? i.value : null; })(),
  stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|审批中|已归档)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
}));
console.log('before', JSON.stringify(before));
const filled = await page.evaluate(({ code, name }) => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const topic = document.querySelector('td.rs-topic-cell input');
  if (topic) setVal(topic, name);
  const tds = [...document.querySelectorAll('td.rs-label')];
  const td = tds.find(t => (t.textContent || '').trim() === '产品编号');
  const inp = td && td.nextElementSibling.querySelector('input');
  if (inp) setVal(inp, code);
  return { topic: topic && topic.value, code: inp && inp.value };
}, cfg);
console.log('filled', JSON.stringify(filled));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存为草稿');
  if (b) b.click();
});
await page.waitForTimeout(5000);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  codeNow: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const i = td && td.nextElementSibling.querySelector('input'); return i ? i.value : null; })(),
  stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|审批中|已归档)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
}));
console.log(JSON.stringify(after, null, 1));
