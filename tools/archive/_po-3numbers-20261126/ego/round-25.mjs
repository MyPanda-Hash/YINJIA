const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

// 点「确定」
const ok = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!box) return { ok: false };
  const btn = [...box.querySelectorAll('button')].find((b) => /确定/.test(t(b)));
  if (!btn) return { ok: false, reason: 'no 确定' };
  btn.click();
  return { ok: true };
});
console.log('点确定:', JSON.stringify(ok));
await page.waitForTimeout(5000);

const after = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    messages: [...document.querySelectorAll('.el-message, .el-notification')].map(t),
    messageBoxes: [...document.querySelectorAll('.el-message-box')].filter((el) => el.offsetParent !== null).map(t),
    status: t(document.querySelector('.doc-status')),
    tags: [...document.querySelectorAll('.dsr-tag')].map(t),
    auditFields: [...document.querySelectorAll('input')].filter((i) => i.offsetParent && i.value).map((i) => `${i.placeholder || '?'}:${i.value}`).slice(0, 20),
    toolbar: [...document.querySelectorAll('.tb-group')].map((g) => `${t(g.querySelector('.act-name'))}${/disabled/.test((g.querySelector('.tb-main') || {}).className || '') ? '(禁)' : ''}`),
  };
});
console.log(JSON.stringify(after, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r25-unaudit-result.png' });
