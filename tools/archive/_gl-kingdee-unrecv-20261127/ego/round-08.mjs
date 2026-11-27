const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// ① 关掉当前对话框
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
  if (!dlg) return;
  const btn = [...dlg.querySelectorAll('button')].find((b) => /取消/.test((b.innerText || '')));
  if (btn) btn.click();
});
await page.waitForTimeout(1500);

// ② 左栏勾两张单
const picked = await page.evaluate(() => {
  const want = ['YJ-20261014-03', 'YJ-20261103-06'];
  const out = [];
  for (const no of want) {
    const tr = [...document.querySelectorAll('tr')].find((x) => (x.innerText || '').includes(no) && x.querySelector('.el-checkbox'));
    if (!tr) { out.push(no + ':没找到行'); continue; }
    const cb = tr.querySelector('.el-checkbox');
    cb.click();
    out.push(no + ':已勾');
  }
  return out;
});
console.log('勾选:', JSON.stringify(picked));
await page.waitForTimeout(1500);

// ③ 生单▼ → 合单生单
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '生单');
  g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(t(el)));
  const item = menu && [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(7000);

const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
  if (!dlg) return { ok: false, note: '没开对话框' };
  const heads = [...dlg.querySelectorAll('table')].filter((x) => x.querySelectorAll('thead th').length)
    .map((x) => [...x.querySelectorAll('thead th')].map((y) => t(y)));
  const bodies = [...dlg.querySelectorAll('table')].filter((x) => x.querySelectorAll('tbody tr').length)
    .map((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => t(y))));
  return {
    ok: true,
    title: t(dlg.querySelector('.el-dialog__title')),
    tips: [...dlg.querySelectorAll('.gl-jd-tip')].map(t),
    heads: heads.slice(0, 2),
    gl008: bodies.flatMap((b) => b).filter((r) => /YJ-GL-008/.test(r.join('|'))).map((r) => r.join(' | ')).slice(0, 4),
    warn: [...dlg.querySelectorAll('.gl-jd-short')].map((el) => t(el)).slice(0, 8),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r08-merge-dialog.png' });
