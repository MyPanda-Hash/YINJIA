// round-06: 重出 6 张标记图(每例先清掉上一例的标注层;PO 用编号圆点代替长标签)
const task = await taskSpace(17);
const page = task.page("p1");
const OUT = "C:/Users/Lenovo/ego/purchase-in-untransferred-20261128";
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });

const cases = [
  {
    out: "pin-0147.png",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0147",
    kind: "PIN", anchor: "YJ-AJ-017", docNo: "PI-2026-09-0147",
    rowBadge: "★ ① 影响明细行(本单唯一一行)",
    heads: [["采购订单号", "② 转ERP 挂的采购订单"], ["批次号", "③ 库存记账批号"]],
    listBadge: "④ 已审核 · 未转ERP",
    cells: [],
    card: [
      ["① 明细行(唯一)", "YJ-AJ-017  PP棉  33*41*204(橘皮)   200 支"],
      ["", "仓库 华北工控仓 · 行「批号」PC0000 · 「批次号」20260924"],
      ["② 对应采购订单行", "YJ-20260915-06 第3行 → 金蝶已入库 2000 / 未入库 0"],
      ["③ 单据状态", "已审核(2026-09-24 14:42) · ERP单号空 = 未转ERP"],
      ["④ 库存台账(实测)", "YJ-AJ-017|CK00006|20260924 入 200 · 现存量 0(被同步抹平)"],
    ],
  },
  {
    out: "pin-0143.png",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0143",
    kind: "PIN", anchor: "YJ-KG-JC-B02", docNo: "PI-2026-09-0143",
    rowBadge: "★ ① 影响明细行(本单唯一一行)",
    heads: [["采购订单号", "② 转ERP 挂的采购订单"], ["批次号", "③ 库存记账批号"]],
    listBadge: "④ 已审核 · 未转ERP",
    cells: [],
    card: [
      ["① 明细行(唯一)", "YJ-KG-JC-B02  金橙客供盖  B-70-04/05   100 套"],
      ["", "仓库 华北工控仓 · 行「批号」PC0000 · 「批次号」20260923"],
      ["② 对应采购订单行", "YJ-20260907-03 第1行 → 金蝶已入库 2000 / 未入库 0"],
      ["③ 单据状态", "已审核(2026-09-23 10:12) · ERP单号空 = 未转ERP"],
      ["④ 库存台账(实测)", "YJ-KG-JC-B02|CK00006|20260923 入 100 · 现存量 0(被同步抹平)"],
    ],
  },
  {
    out: "pin-0115.png",
    url: "http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0115",
    kind: "PIN", anchor: "Y-S-T", docNo: "PI-2026-09-0115",
    rowBadge: "★ ① 影响明细行(本单唯一一行)",
    heads: [["采购订单号", "② 转ERP 挂的采购订单"], ["批次号", "③ 库存记账批号"]],
    listBadge: "④ 已审核 · 未转ERP",
    cells: [],
    card: [
      ["① 明细行(唯一)", "Y-S-T  硫酸氧钛  123334-00-9 工业级93%   10 kg"],
      ["", "仓库 恒亿仓(行/头「仓库编码」都空) · 「批次号」20260922"],
      ["② 对应采购订单行", "YJ-20260915-11 第1行 → 金蝶已入库 600 / 未入库 0"],
      ["③ 单据状态", "已审核(2026-09-22 11:46) · ERP单号空 = 未转ERP"],
      ["④ 库存台账(实测)", "Y-S-T|YCL-01|20260922 入 10 · 现存量 0(被同步抹平)"],
      ["⑤ 额外风险", "仓库编码为空 ⇒ 转ERP 会回落默认仓 CK00001"],
    ],
  },
  {
    out: "po-20260915-06.png",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-06",
    kind: "PO", anchor: "YJ-AJ-017", docNo: "YJ-20260915-06",
    rowBadge: "★ ② 被 PI-2026-09-0147 指的那一行 = 第3行",
    heads: [["单据编号", "采购订单"]],
    listBadge: "订单已完成",
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      ["对应采购入库单", "PI-2026-09-0147 · PP棉 200 支 · 未转ERP"],
      ["本订单行", "第3行 YJ-AJ-017 · 订单数量 2000"],
      ["①②③ 依次为", "数量 2000 / 金蝶已入库 2000 / 金蝶未入库 0"],
      ["结论", "金蝶侧已收满 ⇒ 再收这 200 就是超收"],
    ],
  },
  {
    out: "po-20260907-03.png",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260907-03",
    kind: "PO", anchor: "YJ-KG-JC-B02", docNo: "YJ-20260907-03",
    rowBadge: "★ ② 被 PI-2026-09-0143 指的那一行 = 第1行",
    heads: [["单据编号", "采购订单"]],
    listBadge: "订单已完成",
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      ["对应采购入库单", "PI-2026-09-0143 · 金橙客供盖 100 套 · 未转ERP"],
      ["本订单行", "第1行 YJ-KG-JC-B02 · 订单数量 2000"],
      ["①②③ 依次为", "数量 2000 / 金蝶已入库 2000 / 金蝶未入库 0"],
      ["结论", "金蝶侧已收满 ⇒ 再收这 100 就是超收"],
    ],
  },
  {
    out: "po-20260915-11.png",
    url: "http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-11",
    kind: "PO", anchor: "Y-S-T", docNo: "YJ-20260915-11",
    rowBadge: "★ ② 被 PI-2026-09-0115 指的那一行 = 第1行(唯一行)",
    heads: [["单据编号", "采购订单"]],
    listBadge: "订单已完成",
    cells: ["数量", "金蝶已入库数量", "金蝶未入库数量"],
    card: [
      ["对应采购入库单", "PI-2026-09-0115 · 硫酸氧钛 10 kg · 未转ERP"],
      ["本订单行", "第1行 Y-S-T · 订单数量 600"],
      ["①②③ 依次为", "数量 600 / 金蝶已入库 600 / 金蝶未入库 0"],
      ["结论", "金蝶侧已收满 ⇒ 再收这 10 就是超收"],
    ],
  },
];

const results = [];
for (const c of cases) {
  try {
    await page.goto(c.url, { timeout: 45000 });
    await page.waitForTimeout(4500);
    await page.waitForFunction(
      ({ anchor }) => [...document.querySelectorAll("table tr")].some((tr) => tr.getBoundingClientRect().width > 500 && (tr.innerText || "").includes(anchor)),
      { anchor: c.anchor },
      { timeout: 25000 }
    );
    await page.waitForTimeout(600);

    const info = await page.evaluate((c) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

      // 0) 清掉上一例的标注层(哈希路由不会重载文档)
      document.querySelectorAll("#__shot_layer").forEach((n) => n.remove());

      const bodyRows = [...document.querySelectorAll("table tr")];
      const row = bodyRows.find((tr) => tr.getBoundingClientRect().width > 500 && norm(tr.innerText).includes(c.anchor));
      if (!row) return { error: "anchor row not found" };
      const docRow = bodyRows.find((tr) => norm(tr.innerText).includes(c.docNo) && !norm(tr.innerText).includes(c.anchor));

      const layer = document.createElement("div");
      layer.id = "__shot_layer";
      layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:'Microsoft YaHei',sans-serif";
      document.body.appendChild(layer);

      const box = (rect, color, label, badgePos, radius = 5) => {
        const b = document.createElement("div");
        b.style.cssText = `position:fixed;left:${rect.x - 2}px;top:${rect.y - 2}px;width:${rect.w + 4}px;height:${rect.h + 4}px;` +
          `border:3px solid ${color};border-radius:${radius}px;box-shadow:0 0 0 2px rgba(255,255,255,.9) inset;`;
        layer.appendChild(b);
        if (label) {
          const t = document.createElement("div");
          const below = badgePos === "below";
          t.style.cssText = `position:fixed;left:${rect.x - 2}px;${below ? `top:${rect.y + rect.h + 6}px` : `top:${rect.y - 26}px`};` +
            `background:${color};color:#fff;font-size:12px;font-weight:700;line-height:18px;padding:2px 8px;border-radius:4px;` +
            `white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)`;
          t.textContent = label;
          layer.appendChild(t);
        }
      };
      const dot = (rect, color, num) => {
        const d = document.createElement("div");
        d.style.cssText = `position:fixed;left:${rect.x + 4}px;top:${rect.y + 3}px;width:17px;height:17px;border-radius:50%;` +
          `background:${color};color:#fff;font-size:11px;font-weight:800;line-height:17px;text-align:center;` +
          `box-shadow:0 1px 4px rgba(0,0,0,.3)`;
        d.textContent = String(num);
        layer.appendChild(d);
      };

      // ① 明细行
      const rowRect = R(row);
      box(rowRect, "#e11d48", c.rowBadge, "above");

      // ②③④ 订单行的三列
      if (c.cells && c.cells.length) {
        const table = row.closest("table");
        const headRow = table.querySelector("thead tr") || table.querySelector("tr");
        const ths = [...headRow.children].map((th) => norm(th.innerText));
        const cells = [...row.children];
        const colors = ["#2563eb", "#059669", "#d97706"];
        c.cells.forEach((name, i) => {
          const idx = ths.findIndex((t) => t.includes(name));
          if (idx >= 0 && cells[idx]) {
            const cr = R(cells[idx]);
            box(cr, colors[i % 3], null, null, 4);
            dot(cr, colors[i % 3], i + 1);
          }
        });
      }

      // 表头字段
      (c.heads || []).forEach(([label, badge], i) => {
        const leaf = [...document.querySelectorAll("div,span,td,label")].find((el) => el.children.length === 0 && norm(el.textContent) === label);
        const cell = leaf ? (leaf.closest("td,div")?.parentElement || leaf.parentElement) : null;
        if (cell) box(R(cell), i === 0 ? "#2563eb" : "#7c3aed", badge, "above");
      });

      // 左侧单据列表行
      if (docRow) box(R(docRow), "#d97706", c.listBadge, "below");

      // 说明卡
      const card = document.createElement("div");
      card.style.cssText = "position:fixed;left:1150px;top:850px;width:490px;background:rgba(255,255,255,.97);" +
        "border:2px solid #1f2937;border-radius:8px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:13px;color:#111827";
      const title = document.createElement("div");
      title.style.cssText = "font-size:15px;font-weight:800;margin-bottom:8px;color:#e11d48";
      title.textContent = (c.kind === "PIN" ? "采购入库单 " : "采购订单 ") + c.docNo;
      card.appendChild(title);
      for (const [k, v] of c.card) {
        const line = document.createElement("div");
        line.style.cssText = "margin:4px 0;line-height:20px";
        line.innerHTML = (k ? `<b>${k}</b>：` : "") + v;
        card.appendChild(line);
      }
      const foot = document.createElement("div");
      foot.style.cssText = "margin-top:9px;padding-top:6px;border-top:1px dashed #9ca3af;font-size:11.5px;color:#4b5563";
      foot.textContent = "数据源 localhost:5173 · 登录工厂 YINJIA-MES(正式库 HSDZ_MES) · 2026-11-28";
      card.appendChild(foot);
      layer.appendChild(card);

      return { row: rowRect, layers: document.querySelectorAll("#__shot_layer").length };
    }, c);

    await page.waitForTimeout(250);
    const shot = await page.screenshot({ path: `${OUT}/${c.out}` });
    results.push({ out: c.out, ok: true, info });
    console.log(`[ok] ${c.out} layers=${info.layers} row=${JSON.stringify(info.row)}`);
  } catch (e) {
    results.push({ out: c.out, ok: false, err: String((e && e.message) || e) });
    console.log(`[fail] ${c.out} ${String((e && e.message) || e)}`);
  }
}
console.log(JSON.stringify(results.map((r) => ({ out: r.out, ok: r.ok, err: r.err || null })), null, 2));
