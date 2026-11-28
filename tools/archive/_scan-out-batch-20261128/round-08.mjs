const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

const info = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width) };
  };
  return {
    headCb: box(document.querySelector('.mo-batch-head .el-checkbox')),
    headLot: box(document.querySelector('.mo-batch-head .mo-bh-lot')),
    rowCb: box(document.querySelector('.mo-batch-row .el-checkbox')),
    rowLot: box(document.querySelector('.mo-batch-row .mo-bh-lot')),
    rowLotText: box(document.querySelector('.mo-batch-row .mono')),
  };
});
console.log(JSON.stringify(info, null, 2));
