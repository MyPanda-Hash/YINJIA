const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

const t = `(el)=> (el ? (el.innerText||'').replace(/\\s+/g,' ').trim() : '')`;
const snap = async (tag) => {
  const s = await page.evaluate(() => {
    const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
    return {
      status: t(document.querySelector('.doc-status')),
      tags: [...document.querySelectorAll('.dsr-tag')].map(t),
      messages: [...document.querySelectorAll('.el-message')].map(t),
      boxes: [...document.querySelectorAll('.el-message-box')].filter((el) => el.offsetParent !== null).map(t),
    };
  });
  console.log(tag, JSON.stringify(s));
  return s;
};

await snap('开始');

// ① 打开审批 ▼ → 点弃审
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审批');
  g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /弃审/.test(t(el)));
  const item = [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '弃审');
  item.click();
});
await page.waitForTimeout(1500);
await snap('点弃审后');
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r28-1-confirm.png' });

// ② 确定
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  const btn = [...box.querySelectorAll('button')].find((b) => /确定/.test(t(b)));
  btn.click();
});
await page.waitForTimeout(1100);          // 抢在提示消失前截图
const afterUnaudit = await snap('确定后(即时)');
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r28-2-success.png' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r28-3-draft.png' });

// ③ 复核回去
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审核');
  g.querySelector('.tb-main').click();
});
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!box) return;
  const btn = [...box.querySelectorAll('button')].find((b) => /确认审核/.test(t(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(6000);
const final = await snap('复核后');
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r28-4-reaudited.png' });
console.log('FINAL_STATUS=' + final.status);
