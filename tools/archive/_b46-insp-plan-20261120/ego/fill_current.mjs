const fs = await import('node:fs/promises');
const cfg = JSON.parse(await fs.readFile('D:/workspace/yinjia/_scratch/b46/ego/next.json', 'utf8')); // {code}
const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');

const data = [
  { proj: '*外观', req: '清洁、无破损无压痕，无裂纹、无倾斜等缺陷；切面平整无锯齿纹路，无明显缺角', method: '目视', freq: '1%/一个生产批次', note: '' },
  { proj: '*整体尺寸', req: '外径：待定；内径：待定；长度：待定', method: '游标卡尺', freq: '1%/一个生产批次', note: '尺寸以图纸/规格书最终确认为准' },
  { proj: '*出货重量', req: '＞待定g', method: '电子秤', freq: '1%/一个生产批次', note: '' },
  { proj: '*压降测试', req: '测试流速3L/min，压降≤待定kpa', method: '数显压力表', freq: '1PCS/一个生产批次', note: '' },
  { proj: '*抗压强度（裸棒）', req: '下压速度5mm/min，断裂时读取最大力；标准：＞待定kgf', method: '普研PY-880', freq: '1PCS/一个生产批次', note: '' },
  { proj: '*黑水及颗粒物测试', req: '浸泡4H：无肉眼可见黑水，浊度≤3NTU，颗粒物≤6颗', method: '烧杯+浊度仪：冲水5min后浸泡4H，接出水500ml观察', freq: '1PCS/一个生产批次', note: '' },
];

// ── 1. 选产品编号
await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td.rs-label')];
  const td = tds.find(t => (t.textContent || '').trim() === '产品编号');
  const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl');
  if (ref) ref.click();
});
await page.waitForTimeout(2500);
const kw = '.el-dialog:not([style*="display: none"]) input[placeholder="输入关键字过滤…"]';
await page.fill(kw, cfg.code);
await page.press(kw, 'Enter');
await page.waitForTimeout(2500);
const n = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  return d ? d.querySelectorAll('tbody tr').length : -1;
});
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  const tr = d && d.querySelector('tbody tr');
  if (tr) tr.click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  const btn = d && [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('确定导入'));
  if (btn) btn.click();
});
await page.waitForTimeout(5000);
const headProduct = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td.rs-label')];
  const td = tds.find(t => (t.textContent || '').trim() === '产品编号');
  const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl');
  return ref ? (ref.textContent || '').trim() : null;
});
console.log('refRows', n, 'headProduct', JSON.stringify(headProduct));

// ── 2. 加行 + 填文本 + 表尾
for (let i = 0; i < data.length; i++) {
  await page.evaluate(() => { const b = document.querySelector('.rs-add'); if (b) b.click(); });
  await page.waitForTimeout(250);
}
await page.waitForTimeout(900);
const rowsCount = await page.evaluate((data) => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  data.forEach((d, i) => {
    const tr = rows[i];
    if (!tr) return;
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const seq = tds[0].querySelector('textarea, input');
    if (seq && !seq.value) setVal(seq, String(i + 1));
    const p = tds[1].querySelector('textarea, input'); if (p) setVal(p, d.proj);
    const q = tds[2].querySelector('textarea, input'); if (q) setVal(q, d.req);
    const m = tds[3].querySelector('textarea, input'); if (m) setVal(m, d.method);
    const nt = tds[5].querySelector('textarea, input'); if (nt) setVal(nt, d.note);
  });
  const foot = document.querySelector('.rsp-footer-field textarea');
  if (foot) setVal(foot, '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性');
  return rows.length;
}, data);
console.log('rowsCount', rowsCount);

// ── 3. 检查频率(逐行带校验重试)
const readFreq = () => page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  return [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).map(tr => {
    const sel = [...tr.querySelectorAll('td.rs-td')][4].querySelector('.el-select');
    return sel ? [...sel.querySelectorAll('.el-select__selected-item')].map(s => (s.textContent || '').trim()).filter(Boolean).join('/') : '';
  });
});
for (let i = 0; i < data.length; i++) {
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    const cur = await readFreq();
    if (cur[i] === data[i].freq) { ok = true; break; }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate((i) => {
      const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
      const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6);
      const inp = [...rows[i].querySelectorAll('td.rs-td')][4].querySelector('.el-select input');
      if (inp) { inp.focus(); inp.click(); }
    }, i);
    await page.waitForTimeout(700);
    await page.evaluate((target) => {
      const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(el => el.offsetParent !== null);
      const hit = items.find(el => (el.textContent || '').trim() === target);
      if (hit) hit.click();
    }, data[i].freq);
    await page.waitForTimeout(600);
  }
  const cur = await readFreq();
  if (cur[i] !== data[i].freq) console.log('FREQ FAIL row', i, cur[i], data[i].freq);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── 4. 保存为草稿
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存为草稿');
  if (b) b.click();
});
await page.waitForTimeout(6000);
const out = await page.evaluate(() => {
  const t = [...document.querySelectorAll('table.rs-dt')].find(x => !x.classList.contains('rsp-design-t'));
  const rows = [...t.querySelectorAll('tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).map(tr => {
    const tds = [...tr.querySelectorAll('td.rs-td')];
    const ta = (i) => { const e = tds[i].querySelector('textarea, input'); return e ? e.value : ''; };
    const sel = tds[4].querySelector('.el-select');
    return [ta(0), ta(1), sel ? [...sel.querySelectorAll('.el-select__selected-item')].map(s => (s.textContent || '').trim()).filter(Boolean).join('/') : ''];
  });
  return {
    msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
    headProduct: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl'); return ref ? (ref.textContent || '').trim() : null; })(),
    rows,
  };
});
console.log(JSON.stringify(out, null, 1));
