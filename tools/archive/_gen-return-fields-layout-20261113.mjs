// 生成「销售退货单 / 生产退料单」的字段布局迁移(排序 + 显示/隐藏)
// 判据(2026-11-13 用户口径「对照着销售出库单/生产领料单的字段,还有金蝶有数据的字段,做好排序和隐藏」):
//   ① 参照面板(SALE_OUT / MATERIAL_OUT)里可见的业务字段 → 保留(同名同位置强度)
//   ② 金蝶真实账套里有数据(pct>0)的键 → 放开显示(见 tools/archive/_ret-docs-20261113/ret-fieldfill.json)
//   ③ MES 业务必需(单号/日期/状态/ERP 留痕/备注/附件/退货原因)→ 保留
//   ④ 技术族(id/是否多单位/仓位/辅助属性/换算/基本单位/开票/财务分摊…)→ 一律隐藏,即使金蝶有值
// 产物:tools/migrate-return-fields-layout-20261113.sql(幂等:先全隐藏+归位,再逐条放开)
import { writeFileSync } from 'node:fs';

const out = [];
const w = (s = '') => out.push(s);
const lit = (s) => "N'" + String(s).replace(/'/g, "''") + "'";

// ── 可见字段(顺序即 seq,10/20/30…;place 决定出现在表头还是明细)──────────────
const LAYOUT = {
  SALE_IN: {
    name: '销售退货单',
    sibling: 'SALE_OUT(销售出库单)',
    kingdee: 'sal_in_bound',
    // 金蝶 sal_in_bound 额外需要、但 SALE_OUT 面板没有登记的字段(先补行再排位)
    addFields: [
      { col: '备注', label: '备注', type: '文本', width: 240, place: 'header', editable: 1, required: 0 },
    ],
    head: [
      ['单据编号', 'query,header'], ['单据日期', 'query,header'], ['客户', 'query,header'],
      ['客户编码', 'header'], ['出库类别', 'header'], ['销售订单号', 'query,header'],
      ['经手人', 'query,header'], ['部门', 'header'],
      ['联系人', 'header'], ['联系人电话', 'header'],
      ['退货原因', 'header'], ['备注', 'header'],
      ['附件', 'header'], ['附件1', 'header'], ['附件2', 'header'], ['附件3', 'header'],
      ['附件4', 'header'], ['附件5', 'header'], ['附件6', 'header'],
      ['ERP单号', 'header'], ['是否已转ERP', 'header'], ['转ERP操作人', 'header'], ['转ERP时间', 'header'],
      ['创建时间', 'header'],
    ],
    detail: [
      ['存货编码', 'query,detail'], ['存货名称', 'detail'], ['规格型号', 'detail'], ['计量单位', 'detail'],
      ['数量', 'detail'], ['售价', 'detail'], ['含税售价', 'detail'], ['销售金额', 'detail'],
      ['税率%', 'detail'], ['税额', 'detail'], ['含税销售金额', 'detail'], ['折扣金额', 'detail'],
      ['成本价', 'detail'], ['批号', 'query,detail'], ['仓库', 'query,detail'],
      ['退货数量', 'detail'], ['源单行号', 'detail'], ['现存量', 'detail'],
    ],
  },
  MATERIAL_RET: {
    name: '生产退料单',
    sibling: 'MATERIAL_OUT(材料出库单)',
    kingdee: 'inv_pick_ret',
    addFields: [],
    head: [
      ['单据编号', 'query,header'], ['单据日期', 'query,header'], ['业务类型', 'query,header'],
      ['生产车间', 'query,header'], ['部门编码', 'header'], ['领用人', 'query,header'], ['经手人编码', 'header'],
      ['出库类别', 'query,header'], ['加工单号', 'header'], ['工单行号', 'query,header'],
      ['来源单据', 'query,header'], ['来源单号', 'header'], ['备注', 'header'],
      ['ERP单号', 'header'], ['是否已转ERP', 'header'], ['转ERP操作人', 'header'], ['转ERP时间', 'header'],
      ['创建时间', 'header'], ['金蝶单据状态', 'header'],
    ],
    detail: [
      ['材料编码', 'query,detail'], ['材料名称', 'detail'], ['规格型号', 'detail'], ['计量单位', 'detail'],
      ['数量', 'detail'], ['单价', 'detail'], ['金额', 'detail'], ['批号', 'query,detail'],
      ['仓库', 'query,detail'], ['仓库编码', 'detail'], ['行号', 'detail'],
      ['成本', 'detail'], ['单位成本', 'detail'], ['现存量', 'detail'], ['明细备注', 'detail'],
    ],
  },
};

w('/* ============================================================');
w('   migrate-return-fields-layout-20261113.sql — 2026-11-13');
w('   销售退货单 SALE_IN / 生产退料单 MATERIAL_RET 的**字段排序 + 显示/隐藏**定稿');
w('   (用户口径 2026-11-13:「对照着销售出库单的字段,还有金蝶有数据的字段,做好排序和隐藏;');
w('     生产退料则根据生产领料单的字段和金蝶的数据字段,做好排序和隐藏」)');
w('');
w('   判据(全部可复核,不靠印象):');
w('     ① 参照面板可见的业务字段保留 → 销售退货=销售出库单,生产退料=材料出库单(生产领料单);');
w('     ② 金蝶真实账套**有数据**的键放开显示 → 非空率见 tools/archive/_ret-docs-20261113/ret-fieldfill.json');
w('        (销售退货 30 单/45 行、生产退料 30 单/113 行,逐键统计);');
w('     ③ MES 业务必需(单号/日期/状态/ERP 留痕/备注/附件/退货原因)保留;');
w('     ④ 技术族(id / 是否多单位 / 仓位 / 辅助属性 / 换算 / 基本单位 / 开票 / 财务分摊)一律隐藏,即使金蝶有值。');
w('');
w('   幂等:先「全隐藏 + 把 query 前缀收掉」,再按清单逐条放开并写 seq,可重复执行。');
w('   生成器:tools/archive/_gen-return-fields-layout-20261113.mjs(改布局请改生成器后重跑)。');
w('   ============================================================ */');
w('SET NOCOUNT ON;');
w('GO');

for (const [panel, spec] of Object.entries(LAYOUT)) {
  w('');
  w(`-- ========== ${spec.name}(${panel})· 布局定稿 ==========`);
  // ① 补字段(参照面板没登记、但金蝶有该键的)
  for (const f of spec.addFields) {
    w(`-- 补字段 ${f.label}(金蝶 ${spec.kingdee} 有该键,参照面板未登记)`);
    w(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'${panel}' AND col_name = N'${f.col}')`);
    w(`INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)`);
    w(`VALUES (N'${panel}', ${lit(f.col)}, ${lit(f.label)}, ${lit(f.type)}, NULL, NULL, NULL, NULL, ${lit(f.place)}, 999, ${f.width}, ${f.editable}, ${f.required}, 1, NULL, 0, NULL, NULL, NULL, NULL);`);
  }
  // ② 全隐藏 + query 前缀归位(表头类留 header,明细类留 detail)
  w(`-- ② 全隐藏并归位(可重复执行):查询区前缀一律收掉,只保留 header/detail 归属`);
  w(`UPDATE yj_field SET hidden = 1, visible = 0,`);
  w(`       place = CASE`);
  w(`           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'`);
  w(`           WHEN place LIKE N'%header%' THEN N'header'`);
  w(`           WHEN place LIKE N'%detail%' THEN N'detail'`);
  w(`           ELSE N'detail' END`);
  w(`WHERE panel_code = N'${panel}';`);
  // ③ 逐条放开
  w(`-- ③ 按清单放开并写顺序(表头 10/20/…,明细 10/20/… 各自编号)`);
  const emit = (rows, kind) => rows.forEach(([col, place], i) => {
    w(`UPDATE yj_field SET place = ${lit(place)}, seq = ${(i + 1) * 10}, hidden = 0, visible = 1`);
    w(` WHERE panel_code = N'${panel}' AND col_name = ${lit(col)};`);
  });
  w(`-- 表头 ${spec.head.length} 个字段`);
  emit(spec.head, 'head');
  w(`-- 明细 ${spec.detail.length} 个字段`);
  emit(spec.detail, 'detail');
}

// ── 自检 ──────────────────────────────────────────────────────────────
w('');
w('-- ④ 自检(全 PASS 才算布局定稿)');
w(`DECLARE @chk TABLE(项 nvarchar(60), 期望 int, 实际 int);`);
const chk = (label, expect, expr) => {
  w(`INSERT @chk SELECT N'${label}', ${expect}, ${expr};`);
};
for (const [panel, spec] of Object.entries(LAYOUT)) {
  chk(`${panel} 可见表头 ${spec.head.length}`, spec.head.length,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%')`);
  chk(`${panel} 可见明细 ${spec.detail.length}`, spec.detail.length,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%')`);
  chk(`${panel} 仍带 query 前缀的隐藏字段 0`, 0,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 1 AND place LIKE N'%query%')`);
  chk(`${panel} seq 为 0/空 的可见字段 0`, 0,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND visible = 1 AND ISNULL(seq, 0) = 0)`);
}
w(`SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;`);
w(`SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;`);
w('GO');

writeFileSync(new URL('../migrate-return-fields-layout-20261113.sql', import.meta.url), out.join('\n'), 'utf8');
console.log('写出 tools/migrate-return-fields-layout-20261113.sql,行数 =', out.length);
for (const [p, s] of Object.entries(LAYOUT)) console.log(`${p}: 表头 ${s.head.length} / 明细 ${s.detail.length} / 补字段 ${s.addFields.length}`);

