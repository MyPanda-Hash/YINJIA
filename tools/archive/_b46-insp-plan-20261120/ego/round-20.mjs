const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');

const data = [
  { proj: '*外观', req: '清洁、无破损无压痕，无裂纹、无倾斜等缺陷；切面平整无锯齿纹路，无明显缺角', method: '目视', note: '' },
  { proj: '*整体尺寸', req: '外径：46±0.5mm；内径：待定；长度：待定', method: '游标卡尺', note: '尺寸以图纸/规格书最终确认为准' },
  { proj: '*出货重量', req: '＞待定g', method: '电子秤', note: '' },
  { proj: '*压降测试', req: '测试流速3L/min，压降≤待定kpa', method: '数显压力表', note: '' },
  { proj: '*抗压强度（裸棒）', req: '下压速度5mm/min，断裂时读取最大力；标准：＞待定kgf', method: '普研PY-880', note: '' },
  { proj: '*黑水及颗粒物测试', req: '浸泡4H：无肉眼可见黑水，浊度≤3NTU，颗粒物≤6颗', method: '烧杯+浊度仪：冲水5min后浸泡4H，接出水500ml观察', note: '' },
];

const filled = await page.evaluate((data) => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const out = [];
  data.forEach((d, i) => {
    const tr = rows[i];
    if (!tr) { out.push('missing row ' + i); return; }
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const seqEl = tds[0].querySelector('textarea, input');
    const p = tds[1].querySelector('textarea, input');
    const q = tds[2].querySelector('textarea, input');
    const m = tds[3].querySelector('textarea, input');
    const n = tds[5].querySelector('textarea, input');
    if (seqEl && !seqEl.value) setVal(seqEl, String(i + 1));
    if (p) setVal(p, d.proj);
    if (q) setVal(q, d.req);
    if (m) setVal(m, d.method);
    if (n) setVal(n, d.note);
    out.push({ row: i, seq: seqEl ? seqEl.value : null, proj: p ? p.value : null });
  });
  return { rowCount: rows.length, out };
}, data);
console.log(JSON.stringify(filled, null, 1));
