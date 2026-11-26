const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const items = [...document.querySelectorAll('.tb-main, [class*="tb-"]')].map((el) => ({
    cls: el.className,
    act: txt(el.querySelector('.act-name') || el),
    disabled: /disabled/.test(el.className),
  })).filter((x) => x.act);
  const statusEls = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && /^(已审核|未审核|已作废|草稿)$/.test(txt(el)))
    .map((el) => ({ text: txt(el), cls: String(el.className).slice(0, 40) }));
  const labels = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && /审核人|审核时间|单据编号/.test(txt(el)))
    .map((el) => txt(el)).slice(0, 12);
  const vals = [...document.querySelectorAll('input')].filter((i) => i.offsetParent && i.value).map((i) => `${i.placeholder || i.name || '?'}:${i.value}`).slice(0, 25);
  return { items, statusEls, labels, vals, bodySlice: txt(document.body).slice(0, 500) };
});
console.log(JSON.stringify(info, null, 1).slice(0, 6000));
