const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.waitForTimeout(3000);
const st = await p.evaluate(() => ({
  hash: location.hash, title: document.title,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  hasToken: !!localStorage.getItem('mes_token'),
  html: document.body.innerHTML.slice(0, 200),
}));
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/probe-state.png' });
await task.finish({ keep: [] });
process.exit(0);
