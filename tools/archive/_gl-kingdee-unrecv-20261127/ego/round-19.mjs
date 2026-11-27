const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const ev = await page.events();
const list = Array.isArray(ev) ? ev : (ev && ev.events) || [];
console.log('事件数:', list.length);
for (const e of list.slice(-25)) {
  const s = JSON.stringify(e);
  if (/error|Error|warn|exception/i.test(s)) console.log(s.slice(0, 400));
}
