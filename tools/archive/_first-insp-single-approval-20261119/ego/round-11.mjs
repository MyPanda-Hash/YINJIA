const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
// 关掉上一轮的必填提示(若有)
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.as-side-btn')]
    .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === '选生产工单' && !x.classList.contains('disabled'));
  if (!el) throw new Error('没有「选生产工单」按钮');
  el.click();
});
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null);
  return {
    dialogs: dlg.map((d) => ({
      title: txt(d.querySelector('.el-dialog__title')),
      body: txt(d.querySelector('.el-dialog__body')).slice(0, 600),
      rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map(txt)),
      inputs: [...d.querySelectorAll('input')].map((i) => i.placeholder || i.value).slice(0, 8),
      btns: [...d.querySelectorAll('button')].map(txt),
    })),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-11-wo-dialog.png', fullPage: true });
