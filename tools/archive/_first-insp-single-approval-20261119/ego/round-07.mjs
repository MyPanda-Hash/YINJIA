const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const wanted = ['新增', '保存', '保存为草稿', '提交审批', '审批通过', '审批驳回', '审批情况', '弃审', '打印', '预览', '导出', '删除单据', '审核'];
  const hits = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length > 2) return;
    const t = txt(el);
    if (!t || t.length > 12) return;
    if (wanted.some((w) => t === w || t.startsWith(w))) {
      const r = el.getBoundingClientRect();
      hits.push({ t, tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), x: Math.round(r.x), y: Math.round(r.y) });
    }
  });
  return { hash: location.hash, hits: hits.slice(0, 40) };
});
console.log(JSON.stringify(info, null, 2));
