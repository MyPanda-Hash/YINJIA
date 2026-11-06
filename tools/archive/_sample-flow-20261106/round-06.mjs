const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
console.log('click 提交审批:', await p.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].filter((x) => x.offsetParent && (x.textContent || '').trim() === '提交审批').pop();
  if (!b) return 'no btn';
  b.click(); return 'clicked';
}));
await p.waitForTimeout(2500);
const dlg = await p.evaluate(() => {
  const vis = (x) => x && x.offsetParent !== null;
  const boxes = [...document.querySelectorAll('.el-message-box, .el-dialog, .el-overlay-dialog, .el-popconfirm')].filter(vis);
  return boxes.map((b) => ({ cls: b.className.slice(0, 60), text: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    btns: [...b.querySelectorAll('.el-button')].map((x) => (x.textContent || '').trim()) }));
});
console.log('overlays:', JSON.stringify(dlg, null, 1));
await p.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/probe-submit.png' });
await task.finish({ keep: [] });
process.exit(0);
