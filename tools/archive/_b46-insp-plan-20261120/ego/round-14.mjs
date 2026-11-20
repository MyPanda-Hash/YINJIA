const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');

const res = await page.evaluate(() => {
  const setInput = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (label) => {
    const tds = [...document.querySelectorAll('td.rs-label')];
    const td = tds.find(t => (t.textContent || '').trim() === label);
    if (!td) return null;
    return td.nextElementSibling;
  };
  const filled = [];
  const topic = document.querySelector('td.rs-topic-cell input');
  if (topic) { setInput(topic, 'B-46-10-1 炭棒滤芯'); filled.push('产品名称'); }
  const c = byLabel('产品编号');
  const inp = c && c.querySelector('input');
  if (inp) { setInput(inp, 'B-46-10-1'); filled.push('产品编号'); }
  return { filled, topicVal: topic && topic.value };
});
console.log('filled', JSON.stringify(res));

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存为草稿');
  if (b) b.click();
});
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  msgbox: [...document.querySelectorAll('.el-message-box')].filter(e => e.offsetParent !== null).map(e => (e.innerText || '').replace(/\n/g, ' | ')),
  topicVal: (document.querySelector('td.rs-topic-cell input') || {}).value,
  codeVal: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const i = td && td.nextElementSibling.querySelector('input'); return i && i.value; })(),
  status: (document.querySelector('.as-status, .doc-status') || {}).textContent,
}));
console.log(JSON.stringify(after, null, 1));
