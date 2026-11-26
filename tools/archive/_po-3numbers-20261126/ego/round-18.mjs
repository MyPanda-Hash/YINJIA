const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const flds = [...document.querySelectorAll('.el-form-item')].map((it) => ({
    label: txt(it.querySelector('.el-form-item__label')),
    value: txt(it.querySelector('.el-form-item__content')),
  })).filter((x) => x.label);
  const statusBadge = [...document.querySelectorAll('[class*="badge"], [class*="status"], [class*="tag"]')]
    .map((el) => ({ cls: String(el.className).slice(0, 40), text: txt(el) })).filter((x) => x.text && x.text.length < 12).slice(0, 12);
  return { flds: flds.slice(0, 40), statusBadge, hash: location.hash };
});
console.log(JSON.stringify(info, null, 1).slice(0, 6000));
