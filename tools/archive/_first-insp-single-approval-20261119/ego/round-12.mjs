const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const txt = (s) => s;
// 1) 选第一行工单
const picked = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.innerText || '').includes('取消'));
  if (!dlg) return 'no dialog';
  const rows = [...dlg.querySelectorAll('.el-table__body-wrapper tbody tr')];
  if (!rows.length) return 'no rows';
  const first = [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').trim());
  rows[0].querySelector('td').click();
  return first.join(' | ');
});
console.log('picked row:', picked);
await page.waitForTimeout(700);
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.innerText || '').includes('取消'));
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '确定');
  btn.click();
});
await page.waitForTimeout(5000);
const afterPick = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th .fi-colhead-text')].map((s) => (s.innerText || '').trim());
  return {
    docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
    heads,
    inputsWithValue: [...document.querySelectorAll('.fi-head input, .fi-sheet input')].map((i) => i.value).filter(Boolean).slice(0, 12),
    msgs: [...document.querySelectorAll('.el-message')].map(t),
    boxes: [...document.querySelectorAll('.el-message-box__message, .el-dialog__title')].map(t),
  };
});
console.log('after pick:', JSON.stringify(afterPick, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-12-picked.png', fullPage: true });
