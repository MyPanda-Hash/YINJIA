const fs = await import('node:fs/promises');
const cfg = JSON.parse(await fs.readFile('D:/workspace/yinjia/_scratch/b46/ego/del.json', 'utf8'));
const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/' + cfg.panel + '?docNo=' + encodeURIComponent(cfg.docNo), { timeout: 30000 });
await page.waitForTimeout(6500);
const before = await page.evaluate(() => ({
  headProduct: (() => { const td = [...document.querySelectorAll('td.rs-label')].find(t => (t.textContent || '').trim() === '产品编号'); const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl'); return ref ? (ref.textContent || '').trim() : null; })(),
  topic: (document.querySelector('td.rs-topic-cell input') || {}).value,
  rows: (() => { const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t')); if (!t) return -1; return [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).length; })(),
  stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|审批中|已归档)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
}));
console.log('before', JSON.stringify(before));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '删除');
  if (b) b.click();
});
await page.waitForTimeout(1200);
const box = await page.evaluate(() => {
  const m = [...document.querySelectorAll('.el-message-box')].filter(e => e.offsetParent !== null);
  return m.map(x => (x.innerText || '').replace(/\n/g, ' | ').slice(0, 200));
});
console.log('confirmBox', JSON.stringify(box));
await page.evaluate(() => {
  const m = [...document.querySelectorAll('.el-message-box')].filter(e => e.offsetParent !== null)[0];
  if (!m) return;
  const btn = [...m.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '确定');
  if (btn) btn.click();
});
await page.waitForTimeout(5000);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
}));
console.log('after', JSON.stringify(after));
