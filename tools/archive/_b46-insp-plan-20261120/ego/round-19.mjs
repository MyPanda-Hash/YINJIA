const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const b = document.querySelector('.rs-add');
    if (b) b.click();
  });
  await page.waitForTimeout(250);
}
await page.waitForTimeout(1200);
const st = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].map((tr, i) => ({
    i,
    cls: tr.className,
    cells: [...tr.querySelectorAll('td')].map(td => ({
      cls: td.className,
      txt: (td.innerText || '').trim().slice(0, 20),
      inp: !!td.querySelector('input'),
      ta: !!td.querySelector('textarea'),
      sel: !!td.querySelector('.el-select'),
    })),
  }));
  return rows;
});
console.log(JSON.stringify(st, null, 1).slice(0, 4000));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r19-rows.png' });
