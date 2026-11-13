// 生成「销售退货单 / 生产退料单」的字段布局迁移(排序 + 显示/隐藏)
// 判据(用户 2026-11-13 两轮口径):
//   ① 对照参照面板:销售退货 ↔ 销售出库单;生产退料 ↔ 材料出库单(金蝶叫「生产领料单」)
//   ② 金蝶真实账套**有数据**的键放开显示(非空率见 tools/archive/_ret-docs-20261113/ret-fieldfill.json)
//   ③ MES 业务必需保留(单号/日期/状态/ERP 留痕/备注/附件/退货原因/工单号+工单行号)
//   ④ 技术族(id / 是否多单位 / 仓位 / 辅助属性 / 换算 / 基本单位 / 开票 / 财务分摊)一律隐藏
// 产物:tools/migrate-return-fields-layout-20261113.sql(幂等:先全隐藏归位,再按清单放开)
import { writeFileSync } from 'node:fs';

const out = [];
const w = (s = '') => out.push(s);
const lit = (s) => "N'" + String(s).replace(/'/g, "''") + "'";

// fields = 顺序表(seq 按位置 10/20/30…;place 决定出现在表头/明细/查询区)
const LAYOUT = {
  SALE_IN: {
    name: '销售退货单', kingdee: 'sal_in_bound',
    addFields: [
      { col: '备注', label: '备注', type: '文本', width: 240, place: 'header', editable: 1, required: 0 },
    ],
    renameLabels: {},
    fields: [
      // ── 表头
      ['单据编号', 'query,header'], ['单据日期', 'query,header'], ['客户', 'query,header'],
      ['客户编码', 'header'], ['出库类别', 'header'], ['销售订单号', 'query,header'],
      ['经手人', 'query,header'], ['部门', 'header'],
      ['联系人', 'header'], ['联系人电话', 'header'],
      ['退货原因', 'header'], ['备注', 'header'],
      ['附件', 'header'], ['附件1', 'header'], ['附件2', 'header'], ['附件3', 'header'],
      ['附件4', 'header'], ['附件5', 'header'], ['附件6', 'header'],
      ['ERP单号', 'header'], ['是否已转ERP', 'header'], ['转ERP操作人', 'header'], ['转ERP时间', 'header'],
      ['创建时间', 'header'],
      // ── 明细
      ['存货编码', 'query,detail'], ['存货名称', 'detail'], ['规格型号', 'detail'], ['计量单位', 'detail'],
      ['数量', 'detail'], ['售价', 'detail'], ['含税售价', 'detail'], ['销售金额', 'detail'],
      ['税率%', 'detail'], ['税额', 'detail'], ['含税销售金额', 'detail'], ['折扣金额', 'detail'],
      ['成本价', 'detail'], ['批号', 'query,detail'], ['仓库', 'query,detail'],
      ['退货数量', 'detail'], ['源单行号', 'detail'], ['现存量', 'detail'],
    ],
  },
  MATERIAL_RET: {
    name: '生产退料单', kingdee: 'inv_pick_ret',
    addFields: [],
    // 用户口径「生产退料要有工单号和工单行号」:物理列沿用材料出库单的「加工单号」(同一列、同一义),
    // 显示名改成「工单号」——现场就叫工单号;两者同时进**表头与明细**(逐行可见,打印也带出去)。
    renameLabels: { 加工单号: '工单号' },
    fields: [
      // ── 表头(工单号/工单行号放业务类型之后:退料是"按工单行退",先看单再看料)
      ['单据编号', 'query,header'], ['单据日期', 'query,header'], ['业务类型', 'query,header'],
      ['加工单号', 'query,header,detail'], ['工单行号', 'query,header,detail'],
      ['生产车间', 'query,header'], ['部门编码', 'header'], ['领用人', 'query,header'], ['经手人编码', 'header'],
      ['出库类别', 'query,header'], ['来源单据', 'query,header'], ['来源单号', 'header'], ['备注', 'header'],
      ['ERP单号', 'header'], ['是否已转ERP', 'header'], ['转ERP操作人', 'header'], ['转ERP时间', 'header'],
      ['创建时间', 'header'], ['金蝶单据状态', 'header'],
      // ── 明细
      ['材料编码', 'query,detail'], ['材料名称', 'detail'], ['规格型号', 'detail'], ['计量单位', 'detail'],
      ['数量', 'detail'], ['单价', 'detail'], ['金额', 'detail'], ['批号', 'query,detail'],
      ['仓库', 'query,detail'], ['仓库编码', 'detail'], ['行号', 'detail'],
      ['成本', 'detail'], ['单位成本', 'detail'], ['现存量', 'detail'], ['明细备注', 'detail'],
    ],
  },
};

// 改显示名后要补的译名(9 语;en/ja 已存在,不重复插)
const I18N = {
  工单号: { 'zh-TW': '工單號', de: 'Arbeitsauftragsnummer', es: 'Número de orden de trabajo',
    fr: 'Numéro d’ordre de fabrication', ko: '작업 지시 번호', ru: 'Номер производственного заказа',
    th: 'หมายเลขใบสั่งผลิต', vi: 'Số lệnh sản xuất' },
};

w('/* ============================================================');
w('   migrate-return-fields-layout-20261113.sql — 2026-11-13');
w('   销售退货单 SALE_IN / 生产退料单 MATERIAL_RET 的**字段排序 + 显示/隐藏**定稿');
w('   (用户口径:「对照着销售出库单的字段,还有金蝶有数据的字段,做好排序和隐藏;生产退料则根据');
w('     生产领料单的字段和金蝶的数据字段,做好排序和隐藏」+「生产退料要有工单号和工单行号」)');
w('');
w('   判据:① 参照面板可见的业务字段保留;② 金蝶真实账套有数据的键放开(非空率见');
w('   tools/archive/_ret-docs-20261113/ret-fieldfill.json,30 单/逐键);③ MES 业务必需保留;');
w('   ④ 技术族(id/是否多单位/仓位/辅助属性/换算/基本单位/开票/财务分摊)一律隐藏。');
w('');
w('   幂等:先「全隐藏 + 收掉 query 前缀」,再按清单逐条放开并写 seq,可重复执行。');
w('   生成器:tools/archive/_gen-return-fields-layout-20261113.mjs(改布局请改生成器后重跑)。');
w('   ============================================================ */');
w('SET NOCOUNT ON;');
w('GO');

for (const [panel, spec] of Object.entries(LAYOUT)) {
  w('');
  w(`-- ========== ${spec.name}(${panel},金蝶 ${spec.kingdee})· 布局定稿 ==========`);
  for (const f of spec.addFields) {
    w(`-- 补字段 ${f.label}`);
    w(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'${panel}' AND col_name = N'${f.col}')`);
    w(`INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)`);
    w(`VALUES (N'${panel}', ${lit(f.col)}, ${lit(f.label)}, ${lit(f.type)}, NULL, NULL, NULL, NULL, ${lit(f.place)}, 999, ${f.width}, ${f.editable}, ${f.required}, 1, NULL, 0, NULL, NULL, NULL, NULL);`);
  }
  w(`-- ② 全隐藏并归位(可重复执行)`);
  w(`UPDATE yj_field SET hidden = 1, visible = 0,`);
  w(`       place = CASE`);
  w(`           WHEN place LIKE N'%header%' AND place LIKE N'%detail%' THEN N'header,detail'`);
  w(`           WHEN place LIKE N'%header%' THEN N'header'`);
  w(`           WHEN place LIKE N'%detail%' THEN N'detail'`);
  w(`           ELSE N'detail' END`);
  w(`WHERE panel_code = N'${panel}';`);
  w(`-- ③ 按清单放开并写顺序(${spec.fields.length} 个字段)`);
  spec.fields.forEach(([col, place], i) => {
    w(`UPDATE yj_field SET place = ${lit(place)}, seq = ${(i + 1) * 10}, hidden = 0, visible = 1`);
    w(` WHERE panel_code = N'${panel}' AND col_name = ${lit(col)};`);
  });
  const renames = Object.entries(spec.renameLabels || {});
  if (renames.length) {
    w(`-- ④ 显示名调整(用户口径)`);
    for (const [col, label] of renames) {
      w(`UPDATE yj_field SET label = ${lit(label)} WHERE panel_code = N'${panel}' AND col_name = ${lit(col)};`);
    }
  }
  const needI18n = renames.map(([, label]) => label).filter((l) => I18N[l]);
  if (needI18n.length) {
    w(`-- ⑤ 改名后的译名(9 语;en/ja 已存在)`);
    for (const label of needI18n) {
      for (const [locale, text] of Object.entries(I18N[label])) {
        w(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = ${lit(label)} AND locale = N'${locale}')`);
        w(`INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', ${lit(label)}, N'${locale}', ${lit(text)}, N'manual');`);
      }
    }
  }
}

w('');
w('-- ⑥ 自检(全 PASS 才算布局定稿)');
w(`DECLARE @chk TABLE(项 nvarchar(70), 期望 int, 实际 int);`);
const chk = (label, expect, expr) => w(`INSERT @chk SELECT N'${label}', ${expect}, ${expr};`);
for (const [panel, spec] of Object.entries(LAYOUT)) {
  const headN = spec.fields.filter(([, p]) => p.includes('header')).length;
  const detailN = spec.fields.filter(([, p]) => p.includes('detail')).length;
  chk(`${panel} 可见表头 ${headN}`, headN,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 0 AND visible = 1 AND place LIKE N'%header%')`);
  chk(`${panel} 可见明细 ${detailN}`, detailN,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 0 AND visible = 1 AND place LIKE N'%detail%')`);
  chk(`${panel} 隐藏字段残留 query 前缀 0`, 0,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND hidden = 1 AND place LIKE N'%query%')`);
  chk(`${panel} 可见字段 seq 为 0/空 0`, 0,
    `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'${panel}' AND visible = 1 AND ISNULL(seq, 0) = 0)`);
}
chk(`生产退料单 工单号 可见`, 1,
  `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号' AND label = N'工单号' AND visible = 1 AND hidden = 0)`);
chk(`生产退料单 工单行号 可见`, 1,
  `(SELECT COUNT(*) FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'工单行号' AND visible = 1 AND hidden = 0)`);
w(`SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;`);
w(`SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;`);
w('GO');

writeFileSync(new URL('../migrate-return-fields-layout-20261113.sql', import.meta.url), out.join('\n'), 'utf8');
console.log('写出 tools/migrate-return-fields-layout-20261113.sql,行数 =', out.length);
for (const [p, s] of Object.entries(LAYOUT)) {
  console.log(`${p}: 字段 ${s.fields.length}(表头 ${s.fields.filter(([, x]) => x.includes('header')).length} / 明细 ${s.fields.filter(([, x]) => x.includes('detail')).length})`);
}
