const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
// 1) 打开列表里已有数据的草稿 SJ-2026-11-0008
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.dsr-no')].find((e) => (e.textContent || '').trim() === 'SJ-2026-11-0008');
  el.click();
});
await page.waitForTimeout(2500);
// 2) 未保存提示弹窗:转储按钮后选「放弃」
const modal = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box__wrapper');
  if (!box) return null;
  return {
    title: (box.querySelector('.el-message-box__title') || {}).innerText || '',
    msg: (box.querySelector('.el-message-box__message') || {}).innerText || '',
    btns: [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  };
});
console.log('modal:', JSON.stringify(modal));
if (modal) {
  await page.evaluate(() => {
    const box = document.querySelector('.el-message-box__wrapper');
    const btns = [...box.querySelectorAll('button')];
    const btn = btns.find((b) => /放弃|不保存/.test(b.textContent || '')) || btns[btns.length - 1];
    btn.click();
  });
  await page.waitForTimeout(3000);
}
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    docNo: (document.body.innerText.match(/SJ-2026-11-\d+/) || [''])[0],
    workOrder: (document.body.innerText.match(/GD-2026-\d+-\d+/) || [''])[0],
    status: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    filled: [...document.querySelectorAll('.fi-sheet tr.sample-row input')].map((i) => i.value).filter(Boolean).slice(0, 6),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-17-open0008.png', fullPage: true });
