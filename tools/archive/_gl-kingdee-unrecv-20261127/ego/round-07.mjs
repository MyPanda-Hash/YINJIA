const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
  if (!dlg) return { ok: false };
  const tables = [...dlg.querySelectorAll('table')];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length) || tables[0];
  const bodyTb = tables.find((x) => x.querySelectorAll('tbody tr').length) || tables[0];
  const head = [...headTb.querySelectorAll('thead th')].map((x) => t(x));
  const rows = [...bodyTb.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((x) => t(x)));
  const idx = {
    行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'),
    剩余: head.indexOf('剩余'), 金蝶: head.indexOf('金蝶未入库'), 上限: head.indexOf('可送上限'),
  };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数量=${r[idx['数量']]} 剩余=${r[idx['剩余']]} 金蝶未入库=${r[idx['金蝶']]} 可送上限=${r[idx['上限']]}`;
  return {
    ok: true,
    title: t(dlg.querySelector('.el-dialog__title')),
    head,
    rowsCount: rows.length,
    first3: rows.slice(0, 3).map(line),
    gl008: rows.filter((r) => /YJ-GL-008/.test(r.join('|'))).map(line),
    warnCount: dlg.querySelectorAll('.bsd-jd-short, .gl-jd-short').length,
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r07-batch-dialog.png' });
