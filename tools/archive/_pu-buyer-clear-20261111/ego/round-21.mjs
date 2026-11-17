// round-21: 清理探针——把「探针小李」删掉并保存回原名单(只剩孙郝聪)
const task = await taskSpace(3);
const page = task.page('p1');
const state = await page.evaluate(() => ({
  mgrOpen: !!document.querySelector('.pup-mgr-row'),
  rows: [...document.querySelectorAll('.pup-mgr-row')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value)),
}));
console.log('state:', JSON.stringify(state));

if (state.mgrOpen && state.rows.length > 1) {
  const del = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.pup-mgr-row')];
    const last = rows[rows.length - 1];
    const btn = [...last.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '删除');
    if (!btn) return 'no-btn';
    btn.click();
    return 'ok';
  });
  console.log('delete row:', del);
  await page.waitForTimeout(500);
  const save = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.el-dialog button')].find((b) => (b.textContent || '').trim() === '保存名单');
    if (!btn) return 'no-btn';
    btn.click();
    return 'ok';
  });
  console.log('save:', save);
  await page.waitForTimeout(3000);
}
const after = await page.evaluate(() => ({
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  mgrOpen: !!document.querySelector('.pup-mgr-row'),
  rows: [...document.querySelectorAll('.pup-mgr-row')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value)),
  buyerName: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
}));
console.log('after cleanup:', JSON.stringify(after));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-21-cleanup.png' });
