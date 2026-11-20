const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { hash: location.hash, title: document.title, buttons: [...new Set(btns)] };
});
console.log(JSON.stringify(info, null, 2));
