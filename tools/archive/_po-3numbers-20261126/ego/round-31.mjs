const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const log = (m) => console.log(m);

const statusNow = () => page.evaluate(() => (document.querySelector('.doc-status') || {}).innerText || '');
log('当前状态: ' + (await statusNow()));

// 弃审
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审批');
  g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /弃审/.test(t(el)));
  [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '弃审').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  [...box.querySelectorAll('button')].find((b) => /确定/.test(t(b))).click();
});

// 轮询：提示一出现就截图
let shot = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(150);
  const hit = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.el-message')][0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: (el.innerText || '').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (hit && hit.w > 0) {
    log('提示出现: ' + JSON.stringify(hit));
    await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r31-toast-full.png' });
    try {
      await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r31-toast-clip.png', clip: { x: Math.max(0, hit.x - 20), y: Math.max(0, hit.y - 20), width: hit.w + 40, height: hit.h + 40 } });
    } catch (e) { log('clip 失败: ' + e.message); }
    shot = true;
    break;
  }
}
log('截到提示: ' + shot + ', 状态=' + (await statusNow()));

// 复核回去
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审核');
  g.querySelector('.tb-main').click();
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!box) return;
  const btn = [...box.querySelectorAll('button')].find((b) => /确认审核/.test(t(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(5000);
log('最终状态: ' + (await statusNow()));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r31-final.png' });
