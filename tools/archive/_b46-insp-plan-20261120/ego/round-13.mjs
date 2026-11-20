const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const dump = await page.evaluate(() => {
  const out = [];
  for (const tr of document.querySelectorAll('table.rs-t tr')) {
    const tds = [...tr.querySelectorAll(':scope > td')];
    if (!tds.length) continue;
    if (tds.length === 2 && tds[0].classList.contains('rs-company-cell')) continue;
    let i = 0;
    while (i < tds.length) {
      const td = tds[i];
      if (td.classList.contains('rs-label') || td.classList.contains('rs-info-label')) {
        const next = tds[i + 1];
        const inp = next && next.querySelector('input, textarea');
        const ref = next && next.querySelector('.rs-ref-ctl');
        const sel = next && next.querySelector('.el-select');
        out.push({
          label: (td.textContent || '').trim(),
          req: td.classList.contains('rs-req'),
          val: inp ? inp.value : ref ? (ref.textContent || '').trim() : sel ? '(select)' : (next ? (next.textContent || '').trim() : ''),
        });
        i += 2;
      } else {
        if (td.classList.contains('rs-topic-cell')) {
          const inp = td.querySelector('input');
          out.push({ label: '[大标题]', req: td.classList.contains('rs-req'), val: inp ? inp.value : (td.textContent || '').trim() });
        }
        i += 1;
      }
    }
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
