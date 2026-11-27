const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// 关对话框
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
  if (dlg) {
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消/.test((b.innerText || '')));
    if (btn) btn.click();
  }
});
await page.waitForTimeout(1500);

// 左栏模糊搜索:供应商「冠霖」
const searched = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'));
  if (!inp) return { ok: false, note: '没找到搜索框' };
  setVal(inp, '冠霖');
  return { ok: true };
});
console.log('搜索框:', JSON.stringify(searched));
await page.waitForTimeout(800);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .el-button')].find((b) => /查找/.test((b.innerText || '')));
  if (btn) btn.click();
});
await page.waitForTimeout(4000);

const rows = await page.evaluate(() => [...document.querySelectorAll('tr')]
  .map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim())
  .filter((x) => /YJ-2026/.test(x)).slice(0, 12));
console.log('列表行:', JSON.stringify(rows, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r09-search.png' });
