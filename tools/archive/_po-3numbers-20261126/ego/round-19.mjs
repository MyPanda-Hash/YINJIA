const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const acts = await page.evaluate(() => [...document.querySelectorAll('.tb-group')].map((g) => {
  const main = g.querySelector('.tb-main');
  return `${(g.querySelector('.act-name')?.innerText || '').trim()}${main && /disabled/.test(main.className) ? '(禁)' : ''}`;
}));
console.log('工具条:', acts.join(' | '));
