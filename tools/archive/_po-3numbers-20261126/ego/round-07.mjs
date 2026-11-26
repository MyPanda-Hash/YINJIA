const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const docs = ['YJ-20261014-03', 'YJ-20261114-03', 'YJ-20261030-04', 'YJ-20260927-02'];
for (const docNo of docs) {
  await page.goto(`http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=${docNo}`, { timeout: 60000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate((no) => {
    const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
    const t = [...document.querySelectorAll('table.dp-table')][0];
    const head = [...(t?.querySelectorAll('thead th') || [])].map((x) => txt(x));
    const iLine = head.indexOf('行号'), iMat = head.indexOf('物料编码'), iQty = head.indexOf('数量');
    const iIn = head.indexOf('金蝶已入库数量'), iUn = head.indexOf('金蝶未入库数量');
    const rows = [...(t?.querySelectorAll('tbody tr') || [])].map((tr) => {
      const td = [...tr.querySelectorAll('td')].map((x) => txt(x));
      return `行${parseFloat(td[iLine])} ${td[iMat]} 数=${td[iQty]} 已入=${td[iIn]} 未入=${td[iUn]}`;
    });
    return { docNo: no, rows };
  }, docNo);
  console.log(`### ${info.docNo}`);
  console.log(info.rows.join('\n'));
}
