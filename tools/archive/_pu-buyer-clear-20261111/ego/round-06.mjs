// round-06: 摸清工具栏 DOM(打印按钮真实标签)
const task = await taskSpace(3);
const page = task.page('p1');
const info = await page.evaluate(() => {
  const out = [];
  const walk = (el, depth) => {
    if (depth > 4) return;
    for (const c of el.children) {
      const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === '打印' || t.startsWith('打印')) {
        out.push({ tag: c.tagName, cls: c.className, role: c.getAttribute('role'), html: c.outerHTML.slice(0, 200) });
      }
      walk(c, depth + 1);
    }
  };
  walk(document.body, 0);
  return { hits: out.slice(0, 10), allTags: [...new Set([...document.querySelectorAll('body *')].map((e) => e.tagName))].slice(0, 40) };
});
console.log(JSON.stringify(info, null, 2));
