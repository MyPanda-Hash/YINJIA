// round-09(FINAL): 圆点移到右上角 + 盒子按视口裁切,出最终 6 张
const task = await taskSpace(17);
const page = task.page("p1");
const OUT = "C:/Users/Lenovo/ego/purchase-in-untransferred-20261128";
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });

const cases = [
  {
    out: "pin-0147.png", kind: "PIN", docNo: "PI-2026-09-0147", anchor: "YJ-AJ-017",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0147",
    heads: [["采购订单号", 2], ["批次号", 3]],
    card: [
      "<b>① 明细行（本单唯一一行）</b>：YJ-AJ-017 PP棉 33*41*204(橘皮) · 200 支",
      "　仓库 华北工控仓 · 行「批号」PC0000 · 「批次号」20260924",
      "<b>② 采购订单号</b>：YJ-20260915-06 → 该订单<b>第3行</b>",
      "<b>③ 批次号</b>：20260924（库存记账批号，不是 PC0000）",
      "<b>④ 左侧列表</b>：已审核 · ERP单「未转」",
      "<b>结论</b>：订单行金蝶已入库 2000 / 未入库 0 ⇒ 再收这 200 即超收",
      "<b>库存</b>：YJ-AJ-017|CK00006|20260924 入 200 · 现存量 0（被同步抹平）",
    ],
  },
  {
    out: "pin-0143.png", kind: "PIN", docNo: "PI-2026-09-0143", anchor: "YJ-KG-JC-B02",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0143",
    heads: [["采购订单号", 2], ["批次号", 3]],
    card: [
      "<b>① 明细行（本单唯一一行）</b>：YJ-KG-JC-B02 金橙客供盖 B-70-04/05 · 100 套",
      "　仓库 华北工控仓 · 行「批号」PC0000 · 「批次号」20260923",
      "<b>② 采购订单号</b>：YJ-20260907-03 → 该订单<b>第1行</b>",
      "<b>③ 批次号</b>：20260923（库存记账批号，不是 PC0000）",
      "<b>④ 左侧列表</b>：已审核 · ERP单「未转」",
      "<b>结论</b>：订单行金蝶已入库 2000 / 未入库 0 ⇒ 再收这 100 即超收",
      "<b>库存</b>：YJ-KG-JC-B02|CK00006|20260923 入 100 · 现存量 0（被同步抹平）",
    ],
  },
  {
    out: "pin-0115.png", kind: "PIN", docNo: "PI-2026-09-0115", anchor: "Y-S-T",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0115",
    heads: [["采购订单号", 2], ["批次号", 3]],
    card: [
      "<b>① 明细行（本单唯一一行）</b>：Y-S-T 硫酸氧钛 工业级93% · 10 kg",
      "　仓库 恒亿仓（行/头「仓库编码」都空）·「批次号」20260922",
      "<b>② 采购订单号</b>：YJ-20260915-11 → 该订单<b>第1行</b>（唯一行）",
      "<b>③ 批次号</b>：20260922（库存记账批号，不是 PC0000）",
      "<b>④ 左侧列表</b>：已审核 · ERP单「未转」",
      "<b>结论</b>：订单行金蝶已入库 600 / 未入库 0 ⇒ 再收这 10 即超收",
      "<b>额外风险</b>：仓库编码为空 ⇒ 转ERP 会回落默认仓 CK00001",
    ],
  },
  {
    out: "po-20260915-06.png", kind: "PO", docNo: "YJ-20260915-06", anchor: "YJ-AJ-017",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-06",
    heads: [["单据编号", 0]],
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      "<b>① 本行 = 订单第3行</b>：YJ-AJ-017 PP棉 33*41*204(橘皮)",
      "<b>② 数量</b> 2000　<b>③ 金蝶已入库数量</b> 2000　<b>④ 金蝶未入库数量</b> 0",
      "<b>结论</b>：金蝶侧已收满 ⇒ PI-2026-09-0147 那 200 支再收即超收",
      "（对应采购入库单未转ERP，本单 ERP单号为空）",
    ],
  },
  {
    out: "po-20260907-03.png", kind: "PO", docNo: "YJ-20260907-03", anchor: "YJ-KG-JC-B02",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260907-03",
    heads: [["单据编号", 0]],
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      "<b>① 本行 = 订单第1行</b>：YJ-KG-JC-B02 金橙客供盖 B-70-04/05",
      "<b>② 数量</b> 2000　<b>③ 金蝶已入库数量</b> 2000　<b>④ 金蝶未入库数量</b> 0",
      "<b>结论</b>：金蝶侧已收满 ⇒ PI-2026-09-0143 那 100 套再收即超收",
      "（对应采购入库单未转ERP，本单 ERP单号为空）",
    ],
  },
  {
    out: "po-20260915-11.png", kind: "PO", docNo: "YJ-20260915-11", anchor: "Y-S-T",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-11",
    heads: [["单据编号", 0]],
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      "<b>① 本行 = 订单第1行（唯一行）</b>：Y-S-T 硫酸氧钛 工业级93%",
      "<b>② 数量</b> 600　<b>③ 金蝶已入库数量</b> 600　<b>④ 金蝶未入库数量</b> 0",
      "<b>结论</b>：金蝶侧已收满 ⇒ PI-2026-09-0115 那 10 kg 再收即超收",
      "（对应采购入库单未转ERP，本单 ERP单号为空）",
    ],
  },
];

for (const c of cases) {
  await page.goto(c.url, { timeout: 45000 });
  await page.waitForTimeout(4200);
  await page.waitForFunction(
    ({ anchor }) => [...document.querySelectorAll("table tr")].some((tr) => tr.getBoundingClientRect().width > 500 && (tr.innerText || "").includes(anchor)),
    { anchor: c.anchor },
    { timeout: 25000 }
  );
  await page.waitForTimeout(500);

  await page.evaluate((c) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    document.querySelectorAll("#__shot_layer").forEach((n) => n.remove());

    const rows = [...document.querySelectorAll("table tr")];
    const row = rows.find((tr) => tr.getBoundingClientRect().width > 500 && norm(tr.innerText).includes(c.anchor));
    const docRow = rows.find((tr) => norm(tr.innerText).includes(c.docNo) && !norm(tr.innerText).includes(c.anchor));

    const layer = document.createElement("div");
    layer.id = "__shot_layer";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:'Microsoft YaHei',sans-serif";
    document.body.appendChild(layer);

    const VW = innerWidth;
    const mark = (rect0, color, num, dash, dotLeft) => {
      // 裁到视口内(宽表右边界会超出)
      const x = Math.max(rect0.x, 0);
      const w = Math.min(rect0.x + rect0.w, VW - 2) - x;
      const rect = { x, y: rect0.y, w, h: rect0.h };
      const b = document.createElement("div");
      b.style.cssText = `position:fixed;left:${rect.x - 2}px;top:${rect.y - 2}px;width:${rect.w + 4}px;height:${rect.h + 4}px;` +
        `border:3px ${dash ? "dashed" : "solid"} ${color};border-radius:5px;background:${color}14;box-sizing:border-box`;
      layer.appendChild(b);
      if (num) {
        const d = document.createElement("div");
        const dx = dotLeft ? Math.max(rect.x + 4, 2) : Math.min(rect.x + rect.w - 22, VW - 24);
        d.style.cssText = `position:fixed;left:${dx}px;top:${rect.y - 9}px;width:20px;height:20px;border-radius:50%;` +
          `background:${color};color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center;` +
          `box-shadow:0 1px 5px rgba(0,0,0,.35);border:2px solid #fff`;
        d.textContent = String(num);
        layer.appendChild(d);
      }
      return rect;
    };

    mark({ ...R(row), w: Math.min(R(row).w, 2400) }, "#e11d48", 1, false, true);

    if (c.cells && c.cells.length) {
      const allHeadRows = [...document.querySelectorAll("table tr")].map((tr) => [...tr.children].map((th) => norm(th.innerText)));
      const headThs = allHeadRows.find((arr) => arr.some((t) => t.includes("金蝶未入库数量"))) || [];
      const cells = [...row.children];
      const colors = ["#2563eb", "#059669", "#d97706"];
      c.cells.forEach((name, i) => {
        const idx = headThs.findIndex((t) => t === name || t.includes(name));
        if (idx >= 0 && cells[idx]) mark(R(cells[idx]), colors[i % 3], i + 2, false);
      });
    }

    (c.heads || []).forEach(([label, num]) => {
      const cands = [...document.querySelectorAll("div,span,td,label")].filter(
        (el) => el.children.length === 0 && norm(el.textContent) === label && el.getBoundingClientRect().width > 0
      );
      if (!cands.length) return;
      const leaf = cands[0];
      let boxEl = leaf;
      let p = leaf.parentElement;
      for (let i = 0; i < 3 && p; i++) {
        const r = R(p);
        if (r.w > 60 && r.w <= 430 && r.h > 20 && r.h <= 110 && norm(p.innerText).length > label.length) { boxEl = p; break; }
        p = p.parentElement;
      }
      const color = num === 2 ? "#2563eb" : num === 3 ? "#7c3aed" : "#0f766e";
      mark(R(boxEl), color, num, false);
    });

    if (docRow) mark(R(docRow), "#d97706", c.kind === "PIN" ? 4 : null, true);

    const card = document.createElement("div");
    card.style.cssText = "position:fixed;left:1085px;top:815px;width:565px;background:rgba(255,255,255,.98);" +
      "border:2px solid #111827;border-radius:9px;padding:13px 16px;box-shadow:0 10px 26px rgba(0,0,0,.2);font-size:13px;color:#111827";
    const title = document.createElement("div");
    title.style.cssText = "font-size:15px;font-weight:800;margin-bottom:8px;color:#e11d48";
    title.textContent = (c.kind === "PIN" ? "采购入库单 " : "采购订单 ") + c.docNo + (c.kind === "PIN" ? "（已审核·未转ERP）" : "（已完成）");
    card.appendChild(title);
    for (const html of c.card) {
      const line = document.createElement("div");
      line.style.cssText = "margin:4px 0;line-height:21px";
      line.innerHTML = html;
      card.appendChild(line);
    }
    const foot = document.createElement("div");
    foot.style.cssText = "margin-top:9px;padding-top:6px;border-top:1px dashed #9ca3af;font-size:11.5px;color:#4b5563";
    foot.textContent = "数据源 localhost:5173 · 登录工厂 YINJIA-MES(正式库 HSDZ_MES) · 2026-11-28";
    card.appendChild(foot);
    layer.appendChild(card);
  }, c);

  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${c.out}` });
  console.log(`[ok] ${c.out}`);
}
console.log("done");
