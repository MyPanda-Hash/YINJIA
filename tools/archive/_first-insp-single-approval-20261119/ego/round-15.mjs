const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const cands = [...document.querySelectorAll('[class*="dsr"], [class*="doc-item"], [class*="sheet-item"], [class*="list-item"]')]
    .map((el) => ({ cls: (el.className || '').toString().slice(0, 60), t: t(el).slice(0, 60) }))
    .filter((x) => x.t);
  return { cands: cands.slice(0, 30) };
});
console.log(JSON.stringify(info, null, 2));
