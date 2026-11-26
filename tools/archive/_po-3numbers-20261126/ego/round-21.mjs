const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')].map((g) => ({
    act: (g.querySelector('.act-name')?.innerText || '').trim(),
    html: g.outerHTML.replace(/\s+/g, ' ').slice(0, 300),
  }));
  return groups.filter((g) => ['审核', '审批', '更多', '转ERP'].includes(g.act));
});
console.log(JSON.stringify(info, null, 1));
