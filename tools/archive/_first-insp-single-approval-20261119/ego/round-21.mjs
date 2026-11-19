const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(4500);
// 切到「已完成」页签
const tabClicked = await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.dsr-tab')].find((t) => (t.textContent || '').trim() === '已完成');
  if (!tab) return false;
  tab.click();
  return true;
});
await page.waitForTimeout(3500);
const list = await page.evaluate(() => [...document.querySelectorAll('.dsr-no')].map((e) => (e.textContent || '').trim()));
console.log('tabClicked:', tabClicked, 'list:', JSON.stringify(list.slice(0, 10)));
if (list.includes('SJ-2026-11-0013')) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.dsr-no')].find((e) => (e.textContent || '').trim() === 'SJ-2026-11-0013').click();
  });
  await page.waitForTimeout(5000);
}
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    docNo: (document.body.innerText.match(/SJ-2026-11-\d+/) || [''])[0],
    status: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    editable: document.querySelectorAll('.fi-sheet input').length,
    reqCount: document.querySelectorAll('.fi-requirements li').length,
    bodyHasApproverCol: (document.body.innerText || '').includes('批准'),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-21-approved.png', fullPage: true });
