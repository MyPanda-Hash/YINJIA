const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '新增');
  if (b) b.click();
});
await page.waitForTimeout(4000);
const dump = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table.rs-t tr')].map(tr => {
    const cells = [...tr.querySelectorAll('td')].map(td => {
      const lab = td.classList.contains('rs-label');
      const inp = td.querySelector('input, textarea');
      const ref = td.querySelector('.rs-ref-ctl');
      const sel = td.querySelector('.el-select');
      return {
        lab: lab ? (td.textContent || '').trim() : undefined,
        val: inp ? inp.value : (ref ? (ref.textContent || '').trim() : undefined),
        kind: ref ? 'ref' : inp ? (inp.tagName === 'TEXTAREA' ? 'textarea' : 'input') : sel ? 'select' : 'text',
        cls: td.className,
      };
    });
    return cells;
  }).filter(r => r.length);
  return { hash: location.hash, rows };
});
console.log(JSON.stringify(dump, null, 1).slice(0, 6000));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r12-prodnew.png' });
