const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p2');
async function shot(file, out) {
  await p.goto('file://' + file, { timeout: 30000 });
  await p.waitForTimeout(600);
  const size = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  await p.screenshot({ path: out, fullPage: true });
  console.log(out, JSON.stringify(size));
}
await shot('/tmp/dsh-yj-xlsx/ref/ext.html', '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/ref-ext.png');
await shot('/tmp/dsh-yj-xlsx/ref/int.html', '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/ref-int.png');
await task.finish({ keep: [] });
process.exit(0);
