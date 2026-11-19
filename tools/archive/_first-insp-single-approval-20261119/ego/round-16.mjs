const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const before = await page.evaluate(() => [...document.querySelectorAll('.dsr-no')].map((e) => (e.textContent || '').trim()));
console.log('list:', JSON.stringify(before.slice(0, 12)));
const hit = before.includes('SJ-2026-11-0013');
if (hit) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.dsr-no')].find((e) => (e.textContent || '').trim() === 'SJ-2026-11-0013');
    el.click();
  });
  await page.waitForTimeout(5000);
}
const after = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th .fi-colhead-text')].map((s) => (s.innerText || '').trim());
  const vals = [...document.querySelectorAll('.fi-sheet input')].map((i) => i.value).filter(Boolean);
  return {
    docNo: (document.body.innerText.match(/SJ-2026-11-\d+/) || [''])[0],
    workOrder: (document.body.innerText.match(/GD-2026-\d+-\d+/) || [''])[0],
    heads: heads.slice(0, 3), vals: vals.slice(0, 16),
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    status: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
  };
});
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-16-open0013.png', fullPage: true });
