const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const html = await page.evaluate(() => {
  const label = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === '产品编号');
  if (!label) return 'label not found';
  let cell = label.closest('[class]');
  let up = cell;
  for (let i = 0; i < 4 && up && up.parentElement; i++) up = up.parentElement;
  return { labelHtml: label.parentElement.outerHTML.slice(0, 1500), upHtml: up.outerHTML.slice(0, 3000) };
});
console.log(JSON.stringify(html, null, 2));
