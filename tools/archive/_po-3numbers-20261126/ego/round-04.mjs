const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.goto('http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=YJ-20261111-06', { timeout: 60000 });
await page.waitForTimeout(7000);
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const t = [...document.querySelectorAll('table.dp-table')][0];
  const head = [...(t?.querySelectorAll('thead th') || [])].map((th) => txt(th));
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数: head.indexOf('数量'), 已入: head.indexOf('金蝶已入库数量'), 未入: head.indexOf('金蝶未入库数量') };
  const rows = [...(t?.querySelectorAll('tbody tr') || [])].map((tr) => {
    const td = [...tr.querySelectorAll('td')].map((x) => txt(x));
    return { 行号: td[idx.行号], 物料: td[idx.物料], 数: td[idx.数], 已入: td[idx.已入], 未入: td[idx.未入] };
  });
  return { hash: location.hash, head, rows, badge: txt(document.querySelector('.as-badge, .tk-badge, .panelx-head')) };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r04-po-20261111-06.png' });
