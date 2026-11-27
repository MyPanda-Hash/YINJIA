const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
// 关弹窗
for (let i = 0; i < 4; i++) {
  const closed = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
    if (!dlg) return false;
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test((b.innerText || '')));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) break;
  await page.waitForTimeout(900);
}
const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const rows = [...document.querySelectorAll('tr')].filter((tr) => tt(tr).length > 5);
  return {
    hash: location.hash,
    rowCount: rows.length,
    withCheckbox: rows.filter((r) => r.querySelector('.el-checkbox, input[type=checkbox]')).length,
    sample: rows.slice(0, 8).map((r) => ({ text: tt(r).slice(0, 70), cb: !!r.querySelector('.el-checkbox, input[type=checkbox]'), cls: String(r.className).slice(0, 30) })),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 3000));
