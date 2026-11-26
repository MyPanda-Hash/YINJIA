const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const byText = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && /^(弃审|审核|删除|保存)$/.test(txt(el)))
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 50), text: txt(el), parentCls: String(el.parentElement && el.parentElement.className).slice(0, 60) }));
  const withTitle = [...document.querySelectorAll('[title]')].map((el) => el.getAttribute('title')).filter((t) => /弃审|审核|删除/.test(t || ''));
  const toolbar = [...document.querySelectorAll('[class*="toolbar"], [class*="tb-"], [class*="panelx-head"], [class*="act"]')].slice(0, 6)
    .map((el) => ({ cls: String(el.className).slice(0, 70), text: txt(el).slice(0, 120) }));
  return { byText, withTitle, toolbar, head: txt(document.querySelector('.el-card, .panel-card, body')).slice(0, 400) };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
