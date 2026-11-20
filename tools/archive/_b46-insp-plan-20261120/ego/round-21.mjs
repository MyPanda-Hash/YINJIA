const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const freq = ['1%/一个生产批次', '1%/一个生产批次', '1%/一个生产批次', '1PCS/一个生产批次', '1PCS/一个生产批次', '1PCS/一个生产批次'];

for (let i = 0; i < freq.length; i++) {
  const opened = await page.evaluate((i) => {
    const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
    const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
    const tr = rows[i];
    const sel = tr && [...tr.querySelectorAll('td.rs-td')][4].querySelector('.el-select');
    if (!sel) return false;
    const inp = sel.querySelector('input');
    inp.focus();
    inp.click();
    return true;
  }, i);
  await page.waitForTimeout(500);
  const clicked = await page.evaluate((target) => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(el => el.offsetParent !== null);
    const hit = items.find(el => (el.textContent || '').trim() === target) || items.find(el => (el.textContent || '').trim().includes(target));
    if (!hit) return { ok: false, items: items.map(e => (e.textContent || '').trim()) };
    hit.click();
    return { ok: true };
  }, freq[i]);
  if (!clicked.ok) console.log('row', i, 'options', JSON.stringify(clicked.items));
  await page.waitForTimeout(400);
}
const back = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  return rows.map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const selInp = tds[4].querySelector('input');
    return { seq: tds[0].querySelector('textarea') && tds[0].querySelector('textarea').value, proj: tds[1].querySelector('textarea') && tds[1].querySelector('textarea').value, freq: selInp ? selInp.value : '(none)' };
  });
});
console.log(JSON.stringify(back, null, 1));
