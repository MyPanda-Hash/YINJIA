const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const set = await page.evaluate(() => {
  const ta = document.querySelector('.rsp-footer-field textarea');
  if (!ta) return 'no footer textarea';
  const txt = '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性';
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, txt);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  return ta.value.slice(0, 40);
});
console.log('footer set:', set);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存为草稿');
  if (b) b.click();
});
await page.waitForTimeout(6000);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  msgbox: [...document.querySelectorAll('.el-message-box')].filter(e => e.offsetParent !== null).map(e => (e.innerText || '').replace(/\n/g, ' | ')),
  status: (document.querySelector('.as-doc-status, .as-status') || {}).textContent,
  docNo: [...document.querySelectorAll('.rs-docno, .as-select-line')].map(e => (e.textContent || '').trim()).slice(0, 6),
}));
console.log(JSON.stringify(after, null, 1));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r24-saved.png' });
