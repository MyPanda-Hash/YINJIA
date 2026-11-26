const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.goto('http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=YJ-20260921-10', { timeout: 60000 });
await page.waitForTimeout(7000);
const out = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const all = [...document.querySelectorAll('span, div, button')]
    .map(txt)
    .filter((t) => t && /送料|剩余|可补|已送/.test(t) && t.length < 120);
  return { badgeCandidates: [...new Set(all)] };
});
console.log(JSON.stringify(out, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r05-po-send-badge.png' });
