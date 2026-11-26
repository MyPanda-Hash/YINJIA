const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

const docs = ['YJ-20260921-10', 'YJ-20261023-05', 'YJ-20261111-06'];
const out = [];
for (const docNo of docs) {
  await page.goto(`http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=${docNo}`, { timeout: 60000 });
  await page.waitForTimeout(6500);
  const info = await page.evaluate((no) => {
    const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
    const t = [...document.querySelectorAll('table.dp-table')][0];
    const head = [...(t?.querySelectorAll('thead th') || [])].map((x) => txt(x));
    const iLine = head.indexOf('行号');
    const iMat = head.indexOf('物料编码');
    const iQty = head.indexOf('数量');
    const iIn = head.indexOf('金蝶已入库数量');
    const iUn = head.indexOf('金蝶未入库数量');
    const rows = [...(t?.querySelectorAll('tbody tr') || [])].map((tr) => {
      const td = [...tr.querySelectorAll('td')].map((x) => txt(x));
      return { 行号: td[iLine], 物料: td[iMat], 数: td[iQty], 已入: td[iIn], 未入: td[iUn] };
    });
    return { docNo: no, hash: location.hash, onLogin: location.hash.includes('login'), headFound: head.length, rows };
  }, docNo);
  out.push(info);
  console.log(JSON.stringify(info));
}
console.log('\nsummary:', out.map((x) => `${x.docNo}:${x.rows.length}行${x.onLogin ? '(掉登录)' : ''}`).join(' | '));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r06-last-doc.png' });
