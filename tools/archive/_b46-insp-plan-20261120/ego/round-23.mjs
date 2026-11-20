const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const back = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  return rows.map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const ta = (i) => { const e = tds[i].querySelector('textarea, input'); return e ? e.value : ''; };
    const sel = tds[4].querySelector('.el-select');
    const selTxt = sel ? [...sel.querySelectorAll('.el-select__selected-item')].map(s => (s.textContent || '').trim()).filter(Boolean).join('/') : '';
    return { seq: ta(0), proj: ta(1), req: ta(2).slice(0, 24), method: ta(3).slice(0, 14), freq: selTxt, note: ta(5) };
  });
});
console.log(JSON.stringify(back, null, 1));
const footer = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const trs = [...t.querySelectorAll('tbody tr')];
  const f = trs.find(tr => (tr.textContent || '').includes('不合格应对措施'));
  return f ? f.outerHTML.slice(0, 1200) : 'not found';
});
console.log('FOOTER HTML:', footer);
