const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
// 1) 未保存提示 → 不保存
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && (x.innerText || '').includes('未保存提示'));
  if (!d) return false;
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '不保存');
  if (btn) btn.click();
  return true;
});
await page.waitForTimeout(1500);
// 2) 查询单据:填编号并查询
const q = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && (x.innerText || '').includes('查询单据'));
  if (!d) return 'no query dialog';
  const inp = [...d.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊匹配'));
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(inp, 'SJ-2026-11-0013');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return 'filled';
});
console.log('query fill:', q);
await page.waitForTimeout(500);
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && (x.innerText || '').includes('查询单据'));
  const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询');
  btn.click();
});
await page.waitForTimeout(3500);
const list = await page.evaluate(() => [...document.querySelectorAll('.dsr-no')].map((e) => (e.textContent || '').trim()).slice(0, 6));
console.log('list after query:', JSON.stringify(list));
if (list.includes('SJ-2026-11-0013')) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.dsr-no')].find((e) => (e.textContent || '').trim() === 'SJ-2026-11-0013').click();
  });
  await page.waitForTimeout(5000);
}
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const body = (document.body.innerText || '').replace(/\s+/g, ' ');
  const head = {};
  document.querySelectorAll('.fi-headrow input, .fi-sheet input').forEach((i, idx) => { if (idx < 6 && i.value) head[idx] = i.value; });
  return {
    docNo: (body.match(/SJ-2026-11-\d+/) || [''])[0],
    status: (body.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    editable: document.querySelectorAll('.fi-sheet input').length,
    hasApproverCol: body.includes('批准'),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-24-approved.png', fullPage: true });
