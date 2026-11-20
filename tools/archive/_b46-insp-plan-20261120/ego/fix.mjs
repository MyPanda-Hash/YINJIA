const fs = await import('node:fs/promises');
const cfg = JSON.parse(await fs.readFile('D:/workspace/yinjia/_scratch/b46/ego/fix.json', 'utf8')); // { targets: {index: freq} }
const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');

const readRow = async () => page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  return rows.map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const sel = tds[4].querySelector('.el-select');
    return sel ? [...sel.querySelectorAll('.el-select__selected-item')].map(s => (s.textContent || '').trim()).filter(Boolean).join('/') : '';
  });
});

for (const [idxStr, target] of Object.entries(cfg.targets)) {
  const idx = Number(idxStr);
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    const now = await readRow();
    if (now[idx] === target) { ok = true; break; }
    // 先把可能残留的下拉关掉
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate((i) => {
      const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
      const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
      const tds = [...rows[i].querySelectorAll('td.rs-td')];
      const inp = tds[4].querySelector('.el-select input');
      if (inp) { inp.focus(); inp.click(); }
    }, idx);
    await page.waitForTimeout(700);
    const clicked = await page.evaluate((target) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(el => el.offsetParent !== null);
      const hit = items.find(el => (el.textContent || '').trim() === target);
      if (!hit) return false;
      hit.click();
      return true;
    }, target);
    await page.waitForTimeout(600);
    if (!clicked) console.log('row', idx, 'attempt', attempt, 'no option', target);
  }
  const after = await readRow();
  console.log('row', idx, '=>', JSON.stringify(after[idx]), 'target', JSON.stringify(target), after[idx] === target ? 'OK' : 'FAIL');
}

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存为草稿');
  if (b) b.click();
});
await page.waitForTimeout(6000);
const out = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const ta = (i) => { const e = tds[i].querySelector('textarea, input'); return e ? e.value : ''; };
    const sel = tds[4].querySelector('.el-select');
    return { seq: ta(0), proj: ta(1), freq: sel ? [...sel.querySelectorAll('.el-select__selected-item')].map(s => (s.textContent || '').trim()).filter(Boolean).join('/') : '' };
  });
  return { msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()), rows };
});
console.log(JSON.stringify(out, null, 1));
