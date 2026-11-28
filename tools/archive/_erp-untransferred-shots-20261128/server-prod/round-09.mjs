// server round-08: 出 7 张带标记截图(3 张采购入库单 + 4 张采购订单),全部取自生产服务器正式库
const task = await taskSpace(18);
const page = task.page("p1");
const OUT = "C:/Users/Lenovo/ego/server-pin-noterp-20261128";
const BASE = "http://36.140.66.163:8090";
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 2860, height: 1560, deviceScaleFactor: 1, mobile: false });

const cases = [
  {
    out: "pin-0183.png", kind: "PIN", docNo: "PI-2026-11-0183",
    url: BASE + "/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0183",
    rows: [
      { code: "YJ-SX-011-2", lineNo: "7.0000", num: 5, color: "#e11d48",
        badge: "会挡：已收满" },
      { code: "YJ-SX-011-7", lineNo: "12.0000", num: 10, color: "#b91c1c",
        badge: "会挡：已收满" },
    ],
    srcCells: true,
    card: [
      "<b>PI-2026-11-0183（15 行明细，未转ERP）</b> 惠州市双喜科技 · 2026-11-28 · 批次号 20261128",
      "<b>① 行5</b> YJ-SX-011-2 白色底盖（镭雕）1000 个 → 源单 YJ-20261110-03 <b>第7行</b>：订单 1000 / 已入库 1000 / <b>未入库 0</b>",
      "<b>② 行10</b> YJ-SX-011-7 → 同订单 <b>第12行</b>：订单 1000 / 已入库 1000 / <b>未入库 0</b>",
      "以上两行是致命明细：订单行在金蝶已收满，推这张单必被「部分数据已经构建了关联关系 / 分录已关闭」拒绝。",
      "另外 7 行超出未入库量（行3 4000↔3000、行4 4000↔2000、行6 4000↔3000、行7 8000↔5000、行8 8000↔5000、行9 3075↔3000、行12 4000↔2000），也有风险；其余 6 行仍有余额。",
    ],
  },
  {
    out: "pin-0169.png", kind: "PIN", docNo: "PI-2026-11-0169",
    url: BASE + "/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0169",
    rows: [
      { code: "YJ-GL-002", lineNo: "2.0000", num: 2, color: "#e11d48",
        badge: "会挡：已收满" },
      { code: "YJ-GL-004", lineNo: "5.0000", num: 3, color: "#b91c1c",
        badge: "超量：只剩100" },
    ],
    srcCells: true,
    card: [
      "<b>PI-2026-11-0169（3 行明细，未转ERP）</b> 惠州市冠霖实业 · 2026-11-26 · 批次号 20261126",
      "<b>① 行2</b> YJ-GL-002 纸箱 300 个 → YJ-20261014-03 <b>第2行</b>：订单 1000 / 已入库 1000 / <b>未入库 0</b>（收满 ⇒ 会挡）",
      "<b>② 行3</b> YJ-GL-004 纸箱 300 个 → YJ-20260614-04 <b>第5行</b>：订单 2000 / 已入库 1900 / 未入库 100（收 300 &gt; 100 ⇒ 超量）",
      "行1 YJ-GL-019-1 牛皮盒（2支）新 500 个 → YJ-20261121-07 第1行 500 / 0 / 500：有余额，不用管。",
      "这张就是 2026-11-26 报「部分数据已经构建了关联关系」的那张单。",
    ],
  },
  {
    out: "pin-0154.png", kind: "PIN", docNo: "PI-2026-11-0154",
    url: BASE + "/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0154",
    rows: [
      { code: "YJ-GL-035", lineNo: "3.0000", num: 3, color: "#e11d48",
        badge: "会挡：已收满" },
      { code: "YJ-GL-001", src: "YJ-20260924-04", num: 4, color: "#b91c1c",
        badge: "会挡：已超收" },
    ],
    srcCells: true,
    card: [
      "<b>PI-2026-11-0154（4 行明细，未转ERP）</b> 惠州市冠霖实业 · 2026-11-24 · 批次号 20261124",
      "<b>① 行3</b> YJ-GL-035 牛皮盒 180 个 → YJ-20260924-04 <b>第3行</b>：订单 3600 / 已入库 3600 / <b>未入库 0</b>（收满 ⇒ 会挡）",
      "<b>② 行4</b> YJ-GL-001 纸箱 150 个 → 同订单 <b>第6行</b>：订单 1000 / <b>已入库 1125</b> / 未入库 −125（已超收 ⇒ 会挡）",
      "行1 YJ-GL-001 150 个 → YJ-20261014-03 第1行 2000 / 300 / 1700；行2 YJ-GL-003 300 个 → 同订单第3行 2000 / 1280 / 720：都有余额。",
    ],
  },
  {
    out: "po-20261110-03.png", kind: "PO", docNo: "YJ-20261110-03", poCells: true,
    url: BASE + "/#/panelx/list/PU_ORDER?docNo=YJ-20261110-03",
    rows: [
      { code: "YJ-SX-011-2", lineNo: "7.0000", num: 7, color: "#e11d48", badge: "本行已收满" },
      { code: "YJ-SX-011-7", lineNo: "12.0000", num: 12, color: "#b91c1c", badge: "本行已收满" },
    ],
    card: [
      "<b>采购订单 YJ-20261110-03（惠州市双喜科技 · 已审核）</b>",
      "<b>第7行</b> YJ-SX-011-2：数量 1000 / 金蝶已入库 1000 / <b>金蝶未入库 0</b>",
      "<b>第12行</b> YJ-SX-011-7：数量 1000 / 金蝶已入库 1000 / <b>金蝶未入库 0</b>",
      "两行都已被金蝶收满 ⇒ 采购入库单 PI-2026-11-0183 的行5、行10 挂上去必被拒。",
    ],
  },
  {
    out: "po-20261014-03.png", kind: "PO", docNo: "YJ-20261014-03", poCells: true,
    url: BASE + "/#/panelx/list/PU_ORDER?docNo=YJ-20261014-03",
    rows: [
      { code: "YJ-GL-002", lineNo: "2.0000", num: 2, color: "#e11d48", badge: "本行已收满" },
    ],
    card: [
      "<b>采购订单 YJ-20261014-03（已审核）</b>",
      "<b>第2行</b> YJ-GL-002 纸箱：数量 1000 / 金蝶已入库 1000 / <b>金蝶未入库 0</b>",
      "已收满 ⇒ PI-2026-11-0169 行2 那 300 个推不上去;同单第1行（纸箱 1700 未入库）、第3行（720 未入库）都还有余额。",
    ],
  },
  {
    out: "po-20260614-04.png", kind: "PO", docNo: "YJ-20260614-04", poCells: true,
    url: BASE + "/#/panelx/list/PU_ORDER?docNo=YJ-20260614-04",
    rows: [
      { code: "YJ-GL-004", lineNo: "5.0000", num: 5, color: "#b91c1c", badge: "只剩100" },
    ],
    card: [
      "<b>采购订单 YJ-20260614-04</b>",
      "<b>第5行</b> YJ-GL-004 纸箱：数量 2000 / 金蝶已入库 1900 / 未入库 <b>100</b>",
      "只剩 100 ⇒ PI-2026-11-0169 行3 收 300 个超出未入库量（超送金蝶可能放行,也可能拒）。",
    ],
  },
  {
    out: "po-20260924-04.png", kind: "PO", docNo: "YJ-20260924-04", poCells: true,
    url: BASE + "/#/panelx/list/PU_ORDER?docNo=YJ-20260924-04",
    rows: [
      { code: "YJ-GL-035", lineNo: "3.0000", num: 3, color: "#e11d48", badge: "本行已收满" },
      { code: "YJ-GL-001", lineNo: "6.0000", num: 6, color: "#b91c1c", badge: "已超收" },
    ],
    card: [
      "<b>采购订单 YJ-20260924-04</b>",
      "<b>第3行</b> YJ-GL-035 牛皮盒：数量 3600 / 已入库 3600 / <b>未入库 0</b>（收满）",
      "<b>第6行</b> YJ-GL-001 纸箱：数量 1000 / <b>已入库 1125</b> / 未入库 <b>−125</b>（已超收）",
      "⇒ PI-2026-11-0154 的行3、行4 挂上去必被拒。",
    ],
  },
];

for (const c of cases) {
  await page.goto(c.url, { timeout: 60000 });
  await page.waitForTimeout(6500);
  const first = c.rows[0];
  await page.waitForFunction(
    ({ code, lineNo }) => [...document.querySelectorAll("table tr")].some((tr) => tr.getBoundingClientRect().width > 500 && (tr.innerText || "").includes(code) && (!lineNo || (tr.innerText || "").includes(lineNo))),
    { code: first.code, lineNo: first.lineNo || "" },
    { timeout: 30000 }
  );
  await page.waitForTimeout(600);

  const res = await page.evaluate((c) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    document.querySelectorAll("#__shot_layer").forEach((n) => n.remove());
    const VW = innerWidth;
    const layer = document.createElement("div");
    layer.id = "__shot_layer";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:'Microsoft YaHei',sans-serif";
    document.body.appendChild(layer);

    const R_raw = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const mark = (rect0, color, num, dotLeft) => {
      const x = Math.max(rect0.x, 0);
      const w = Math.min(rect0.x + rect0.w, VW - 2) - x;
      const r = { x, y: rect0.y, w, h: rect0.h };
      const b = document.createElement("div");
      b.style.cssText = `position:fixed;left:${r.x - 2}px;top:${r.y - 2}px;width:${r.w + 4}px;height:${r.h + 4}px;` +
        `border:3px solid ${color};border-radius:5px;background:${color}14;box-sizing:border-box`;
      layer.appendChild(b);
      if (num) {
        const d = document.createElement("div");
        const dx = dotLeft ? Math.max(r.x + 4, 2) : Math.min(r.x + r.w - 22, VW - 24);
        d.style.cssText = `position:fixed;left:${dx}px;top:${r.y - (dotLeft ? 13 : 9)}px;width:20px;height:20px;border-radius:50%;` +
          `background:${color};color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center;box-shadow:0 1px 5px rgba(0,0,0,.35);border:2px solid #fff`;
        d.textContent = String(num);
        layer.appendChild(d);
      }
      return r;
    };
    const badge = (rect, color, text) => {
      const t = document.createElement("div");
      t.style.cssText = `position:fixed;right:${innerWidth - (rect.x + rect.w) + 6}px;top:${rect.y + 6}px;background:${color};color:#fff;` +
        `font-size:11.5px;font-weight:700;line-height:17px;padding:0 8px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
      t.textContent = text;
      layer.appendChild(t);
    };

    const allRows = [...document.querySelectorAll("table tr")].filter((tr) => tr.getBoundingClientRect().width > 500 && tr.getBoundingClientRect().height > 20);
    const hitRows = [];
    for (const spec of c.rows) {
      const tr = allRows.find((el) => {
        const t = norm(el.innerText);
        return t.includes(spec.code) && (!spec.lineNo || t.includes(spec.lineNo)) && (!spec.src || t.includes(spec.src));
      });
      if (!tr) { hitRows.push({ spec: spec.code, ok: false }); continue; }
      const rect = mark(R(tr), spec.color, spec.num, true);
      badge(R_raw(tr), spec.color, spec.badge);
      hitRows.push({ spec: spec.code + "/" + (spec.lineNo || spec.src || ""), ok: true, y: Math.round(rect.y) });

      // 采购入库单:框出「采购订单行号」与「源单编号」两格
      if (c.srcCells) {
        for (const cell of [...tr.children]) {
          const t = norm(cell.innerText);
          if (/^\d+\.\d{4}$/.test(t) || /^YJ-\d{8}-\d{2}$/.test(t)) {
            mark(R(cell), "#0f766e", null, false);
          }
        }
      }
      // 采购订单:框出「数量 / 金蝶已入库数量 / 金蝶未入库数量」三列
      if (c.poCells) {
        const heads = [...document.querySelectorAll("table tr")].filter((tr2) => tr2.getBoundingClientRect().width > 500 && tr2.getBoundingClientRect().height > 20)
          .map((tr2) => [...tr2.children].map((th) => norm(th.innerText)))
          .find((arr) => arr.includes("金蝶未入库数量"));
        if (heads) {
          const cells = [...tr.children];
          const colors = ["#2563eb", "#059669", "#d97706"];
          ["数量", "金蝶已入库数量", "金蝶未入库数量"].forEach((name, i) => {
            const idx = heads.indexOf(name);
            if (idx >= 0 && cells[idx]) mark(R(cells[idx]), colors[i], null, false);
          });
        }
      }
    }

    // 左侧单据列表行
    const docRow = allRows.find((tr) => norm(tr.innerText).includes(c.docNo) && !norm(tr.innerText).includes(c.rows[0].code));
    if (docRow) mark(R(docRow), "#d97706", null, false);

    // 说明卡(表格下方空白处)
    const card = document.createElement("div");
    card.style.cssText = "position:fixed;left:1700px;top:1150px;width:1100px;background:rgba(255,255,255,.98);" +
      "border:2px solid #111827;border-radius:9px;padding:13px 18px;box-shadow:0 10px 26px rgba(0,0,0,.2);font-size:13.5px;color:#111827";
    const title = document.createElement("div");
    title.style.cssText = "font-size:16px;font-weight:800;margin-bottom:8px;color:#e11d48";
    title.textContent = (c.kind === "PIN" ? "采购入库单 " : "采购订单 ") + c.docNo + "（" + (c.kind === "PIN" ? "已审核 · 未转ERP" : "采购订单") + "）";
    card.appendChild(title);
    for (const html of c.card) {
      const line = document.createElement("div");
      line.style.cssText = "margin:4px 0;line-height:22px";
      line.innerHTML = html;
      card.appendChild(line);
    }
    const foot = document.createElement("div");
    foot.style.cssText = "margin-top:9px;padding-top:6px;border-top:1px dashed #9ca3af;font-size:11.5px;color:#4b5563";
    foot.textContent = "数据源 http://36.140.66.163:8090 · 登录工厂 YINJIA-MES（服务器正式库） · 2026-11-28";
    card.appendChild(foot);
    layer.appendChild(card);

    return { hitRows, pageH: document.documentElement.scrollHeight };
  }, c);

  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${c.out}` });
  console.log(`[ok] ${c.out} ${JSON.stringify(res.hitRows)}`);
}
console.log("done");
