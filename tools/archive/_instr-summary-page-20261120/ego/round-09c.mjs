const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3500);
const info = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((x) => (x.textContent || '').trim() === '研发管理' && x.children.length <= 2);
  let chain = [];
  let p = el;
  for (let i = 0; i < 4 && p; i++) { chain.push({ tag: p.tagName, cls: p.className }); p = p.parentElement; }
  return { chain, navCandidates: [...document.querySelectorAll('[class*="menu"],[class*="nav"],[class*="side"]')].slice(0, 8).map((x) => ({ tag: x.tagName, cls: x.className })) };
});
console.log(JSON.stringify(info, null, 2));
