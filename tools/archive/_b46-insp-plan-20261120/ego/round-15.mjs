const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?docNo=IP-2026-11-0018', { timeout: 30000 });
await page.waitForTimeout(5000);
const st = await page.evaluate(() => {
  const head = {};
  for (const td of document.querySelectorAll('td.rs-label')) {
    const lab = (td.textContent || '').trim();
    const next = td.nextElementSibling;
    const inp = next && next.querySelector('input');
    const ref = next && next.querySelector('.rs-ref-ctl');
    if (lab) head[lab] = inp ? inp.value : ref ? (ref.textContent || '').trim() : (next ? (next.textContent || '').trim() : '');
  }
  return { hash: location.hash, head, rows: document.querySelectorAll('table.rs-t tbody tr').length };
});
console.log(JSON.stringify(st, null, 1).slice(0, 2000));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r15-plan-draft.png' });
