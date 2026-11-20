const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 3000),
  iframes: [...document.querySelectorAll('iframe')].map(f => f.src),
  btnCount: document.querySelectorAll('button').length,
  containerClasses: [...document.querySelectorAll('.el-container, .main, .content, [class*="list"]')].slice(0, 12).map(e => e.className),
}));
console.log(JSON.stringify(info, null, 2));
