// round-04: 外部开发样品申请单 —— 新增 → 保存 → 提交审批 → 一级审批(选确认人) → 二级确认 → 已审核
const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';

async function clickText(sel, text) {
  return p.evaluate(([s, t]) => {
    const el = [...document.querySelectorAll(s)].filter((e) => e.offsetParent && (e.textContent || '').trim() === t).pop();
    if (!el) return false;
    el.click();
    return true;
  }, [sel, text]);
}
async function dialogFillAndOk(okRe) {
  return p.evaluate((re) => {
    const d = [...document.querySelectorAll('.el-dialog, .el-message-box')].filter((x) => x.offsetParent).pop();
    if (!d) return { ok: false, reason: 'no dialog' };
    const ta = d.querySelector('textarea');
    if (ta) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(ta, '同意');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const btns = [...d.querySelectorAll('.el-button')].filter((b) => b.offsetParent);
    const ok = btns.find((b) => new RegExp(re).test((b.textContent || '').trim()));
    if (ok) { ok.click(); return { ok: true, title: (d.querySelector('.el-dialog__title, .el-message-box__title')?.textContent || '').trim() }; }
    return { ok: false, reason: 'no ok button', btns: btns.map((b) => (b.textContent || '').trim()) };
  }, okRe);
}
const status = async () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-info .as-docno-input input') || {}).value || '',
  status: (document.querySelector('.as-status, .doc-status')?.textContent || '').trim(),
  sign: [...document.querySelectorAll('.sg-sign-item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()),
}));

await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(1000);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6500);

// 新增
console.log('新增:', await clickText('.as-side-btn', '新增'));
await p.waitForTimeout(3500);
console.log('state after 新增:', JSON.stringify(await status()));

// 客户名称 参照
await p.evaluate(() => document.querySelector('.sg-info-ref')?.click());
await p.waitForTimeout(2500);
const pick = await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const rows = d ? [...d.querySelectorAll('.el-table__row')] : [];
  return { open: !!d, rows: rows.length, first: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').slice(0, 40) : '' };
});
console.log('客户弹窗:', JSON.stringify(pick));
if (pick.rows) {
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
    const row = d.querySelector('.el-table__row');
    (row.querySelector('input[type=checkbox]') || row).click();
    const ok = [...d.querySelectorAll('.el-button')].find((b) => /确定|填入|选择/.test(b.textContent || ''));
    if (ok) ok.click();
  });
  await p.waitForTimeout(1500);
}
// 费用
await p.evaluate(() => {
  const cell = [...document.querySelectorAll('.sg-info-cell')].find((c) => (c.textContent || '').includes('费用'));
  const inp = cell?.querySelector('input');
  if (inp) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '350');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
// 表体第一格（产品整体规格）+ 样品数量
await p.evaluate(() => {
  const ta = document.querySelectorAll('.sg-table tbody textarea')[0];
  if (ta) {
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, '组装后总长 180mm，外径 32.5±0.5');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const row = document.querySelector('.sg-table tbody tr');
  const td = row ? row.querySelectorAll('td')[2] : null;
  const inp = td ? td.querySelector('textarea, input') : null;
  if (inp) {
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, '20');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await p.waitForTimeout(600);
await p.screenshot({ path: shotDir + 'flow-1-filled.png' });

console.log('保存:', await clickText('.as-side-btn', '保存'));
await p.waitForTimeout(4500);
console.log('state after 保存:', JSON.stringify(await status()));
await p.screenshot({ path: shotDir + 'flow-2-saved.png' });

console.log('提交审批:', await clickText('.as-side-btn', '提交审批'));
await p.waitForTimeout(2000);
console.log('确认框:', JSON.stringify(await dialogFillAndOk('确定|提交|确认')));
await p.waitForTimeout(5000);
console.log('state after 提交:', JSON.stringify(await status()));
await p.screenshot({ path: shotDir + 'flow-3-submitted.png' });

console.log('审批通过(一级):', await clickText('.as-side-btn', '审批通过'));
await p.waitForTimeout(3000);
const l2 = await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  if (!d) return { open: false };
  const opts = [...d.querySelectorAll('.el-select, .el-radio, .el-table__row')].length;
  return { open: true, title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), opts,
    text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 200) };
});
console.log('L2 弹窗:', JSON.stringify(l2));
await p.screenshot({ path: shotDir + 'flow-4-l2pick.png' });
await task.finish({ keep: [] });
process.exit(0);
