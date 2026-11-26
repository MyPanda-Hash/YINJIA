const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.goto('http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=YJ-20260921-10', { timeout: 60000 });
await page.waitForTimeout(6000);

const state = await page.evaluate(() => ({
  hash: location.hash,
  url: location.href,
  title: document.title,
  hasLogin: !!document.querySelector('input[placeholder*="密码"], input[placeholder*="账号"]'),
  bodyHead: (document.body.innerText || '').slice(0, 400),
}));
console.log(JSON.stringify(state, null, 2));
