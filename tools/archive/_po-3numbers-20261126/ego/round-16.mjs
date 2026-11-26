const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const groups = [...document.querySelectorAll('.tb-group')].map((g) => {
    const main = g.querySelector('.tb-main');
    return { act: txt(g.querySelector('.act-name')), mainCls: main ? main.className : '(no main)', title: main ? main.getAttribute('title') : null };
  });
  const carets = [...document.querySelectorAll('.tb-group')].map((g) => ({ act: txt(g.querySelector('.act-name')), hasCaret: !!g.querySelector('.tb-caret') }));
  return { groups, carets, statusText: txt(document.body).match(/已审核|未审核|草稿|已作废/g)?.slice(0, 5) };
});
console.log(JSON.stringify(info, null, 1));
