const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
// 1) 切回正式账套(我把会话切到测试库做造数验证,这里切回去)
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && (x.innerText || '').includes('未保存提示'));
  if (d) {
    const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '不保存');
    if (btn) btn.click();
  }
});
await page.waitForTimeout(1200);
const cur = await page.evaluate(() => localStorage.getItem('mes_factory'));
if (String(cur).includes('YJ_TEST')) {
  await page.click('.t-left .factory');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.el-dropdown-menu__item')]
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === 'YINJIA-MES');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const inp = document.querySelector('.factory-switch-dialog input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '123456');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.factory-switch-dialog button')]
      .find((b) => (b.textContent || '').includes('切换并重新登录'));
    btn.click();
  });
  await page.waitForTimeout(7000);
}
console.log('factory now:', await page.evaluate(() => localStorage.getItem('mes_factory')));

// 2) 验打包版 8090(前端在 jar 里,换 jar 才变):纸面应已是十条 + 表尾三段
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(6000);
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const body = (document.body.innerText || '').replace(/\s+/g, ' ');
  return {
    host: location.host,
    docNo: (body.match(/SJ-\d{4}-\d{2}-\d{4}/) || [''])[0],
    reqCount: document.querySelectorAll('.fi-requirements li').length,
    firstReq: t(document.querySelector('.fi-requirements li')),
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    bodyHasApprover: body.includes('批准'),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-28-8090.png', fullPage: true });
