// round-01: 看 RD_SAMPLE_EXT / RD_SAMPLE_INT 当前渲染与侧栏按钮（5173 源码版）
const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = await task.newPage();
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(1500);

const login = await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
  return { code: j?.code, hasToken: !!j?.data?.token, factory: j?.data?.factory };
});
console.log('LOGIN', JSON.stringify(login));

async function open(code, shot) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(6500);
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {});
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
    await p.waitForTimeout(400);
  } catch (e) { console.log('restore skip: ' + e.message); }
  const info = await p.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const btns = [...document.querySelectorAll('.as-side-btn')].filter(vis).map((b) => (b.textContent || '').trim());
    const rows = [...document.querySelectorAll('.el-table__row')].filter(vis).map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80));
    const sheet = document.querySelector('.approval-sheet');
    const title = document.querySelector('.as-title')?.innerText || '';
    const tabs = [...document.querySelectorAll('.board-tab,.tab-item')].filter(vis).map((t) => (t.textContent || '').trim()).slice(0, 12);
    return {
      hash: location.hash, title, tabs, btns: btns.slice(0, 14), rows: rows.slice(0, 8),
      sheetW: sheet ? Math.round(sheet.getBoundingClientRect().width) : 0,
      sheetH: sheet ? Math.round(sheet.getBoundingClientRect().height) : 0,
      docStatus: document.querySelector('.as-status')?.innerText?.trim() || '',
    };
  });
  console.log(code, JSON.stringify(info, null, 1));
  await p.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/' + shot });
}
await open('RD_SAMPLE_EXT', 'ext-list.png');
await open('RD_SAMPLE_INT', 'int-list.png');
await task.finish({ keep: [] });
process.exit(0);
