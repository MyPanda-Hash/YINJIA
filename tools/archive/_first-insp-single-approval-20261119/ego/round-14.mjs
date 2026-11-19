const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(4500);
// 若有未保存提示弹窗，选「放弃/关闭」
await page.evaluate(() => {
  const box = document.querySelector('.el-message-box__wrapper');
  if (box) {
    const btns = [...box.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
    const btn = [...box.querySelectorAll('button')].find((b) => /放弃|取消|关闭/.test(b.textContent || ''));
    if (btn) btn.click();
    return btns;
  }
  return null;
});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    docNo: (document.body.innerText.match(/SJ-2026-11-\d+/) || [''])[0],
    allDocNos: [...new Set(document.body.innerText.match(/SJ-2026-11-\d+/g) || [])],
    status: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    railBtns: [...document.querySelectorAll('.as-side-btn')].map((b) => t(b) + (b.classList.contains('disabled') ? '(禁用)' : '')),
    editableInputs: document.querySelectorAll('.fi-sheet input').length,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-14-reload.png', fullPage: true });
