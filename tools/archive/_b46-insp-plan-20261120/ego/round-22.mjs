const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const dump = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  const td = [...rows[0].querySelectorAll('td.rs-td')][4];
  return td.outerHTML.slice(0, 2500);
});
console.log(dump);
await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  const td = [...rows[0].querySelectorAll('td.rs-td')][4];
  const inp = td.querySelector('input');
  if (inp) { inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); inp.click(); }
});
await page.waitForTimeout(1200);
const drops = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')].map(d => ({
  vis: d.offsetParent !== null,
  items: [...d.querySelectorAll('.el-select-dropdown__item')].map(e => (e.textContent || '').trim()).slice(0, 10),
})));
console.log(JSON.stringify(drops, null, 1));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r22-freq-open.png' });
