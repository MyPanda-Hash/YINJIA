const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const reqs = [...document.querySelectorAll('.fi-requirements li')].map(txt);
  const foot = document.querySelector('.fi-foot');
  const footCells = foot ? [...foot.querySelectorAll('th,td')].map((c) => ({ tag: c.tagName.toLowerCase(), t: txt(c) })) : [];
  const infoRows = [...document.querySelectorAll('.fi-info tr')].map((tr) => [...tr.querySelectorAll('th,td')].map(txt));
  const headCells = [...document.querySelectorAll('.fi-head, .fi-headrow, .fi-heads tr')].map((tr) => txt(tr));
  // 抬头四对(产品编号/产品型号/生产日期/组别):取所有含这些标签的 input 值
  const inputs = [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', v: i.value }))
    .filter((x) => x.v || x.ph);
  return {
    hash: location.hash,
    docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
    statusText: (document.body.innerText.match(/单据状态[：:\s]*([^\s|]+)/) || ['', ''])[1],
    reqCount: reqs.length, reqs,
    footCells, infoRows, inputs: inputs.slice(0, 25),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-02-paper.png', fullPage: true });
console.log({ screenshot: shot });
