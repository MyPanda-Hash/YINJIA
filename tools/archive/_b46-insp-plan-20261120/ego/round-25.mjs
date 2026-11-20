const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN?docNo=IP-2026-11-0018', { timeout: 30000 });
await page.reload({ timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { }
const st = await page.evaluate(() => {
  const head = {};
  for (const td of document.querySelectorAll('td.rs-label')) {
    const lab = (td.textContent || '').trim();
    const next = td.nextElementSibling;
    const inp = next && next.querySelector('input');
    const ref = next && next.querySelector('.rs-ref-ctl');
    if (lab && !(lab in head)) head[lab] = inp ? inp.value : ref ? (ref.textContent || '').trim() : (next ? (next.textContent || '').trim() : '');
  }
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const ta = (i) => { const e = tds[i].querySelector('textarea, input'); return e ? e.value : ''; };
    const sel = tds[4].querySelector('.el-select');
    return [ta(0), ta(1), sel ? (sel.innerText || '').replace(/\s+/g, ' ').trim() : ''];
  });
  return { head, rows, status: [...document.querySelectorAll('.as-stage, .as-status, .as-flow-state')].map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 5) };
});
console.log(JSON.stringify(st, null, 1).slice(0, 2500));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r25-final.png', fullPage: false });
