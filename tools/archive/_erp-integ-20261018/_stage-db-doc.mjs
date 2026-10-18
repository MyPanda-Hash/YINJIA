/* 一次性:把「数据库表清单.md」的 HEAD 版本 + 本任务(ERP集成配置)的 4 处改动写回工作区文件。
 * 目的:并行会话对该文件还有未提交改动(v3.42 行),不能整份提交 —— 先只把属于本任务的改动
 * 生成成一份"HEAD + 本任务"的版本供 git add,再把并行会话的版本还原回工作区。
 * 用法:node tools/archive/_erp-integ-20261018/_stage-db-doc.mjs <HEAD版本文件> <输出文件>
 */
import fs from 'node:fs'

const [src, out] = process.argv.slice(2)
if (!src || !out) { console.error('用法: node _stage-db-doc.mjs <head.md> <out.md>'); process.exit(2) }

let t = fs.readFileSync(src, 'utf8')
const crlf = t.includes('\r\n')
const NL = crlf ? '\r\n' : '\n'

function once(from, to, label) {
  const n = t.split(from).length - 1
  if (n !== 1) { console.error(`[FAIL] ${label}: 期望命中 1 次,实际 ${n} 次`); process.exit(1) }
  t = t.replace(from, to)
  console.log(`[OK] ${label}`)
}

once('金蝶云·星辰导入通道、生单占用链、报表列设置、单据号池。',
  '金蝶云·星辰导入通道、ERP 集成配置（接口 / 字段映射 / 设备绑定）、生单占用链、报表列设置、单据号池。',
  '§八 导语')

once('> 共 5 张', '> 共 8 张', '§八 表数 5→8')

const anchorRow = '| `erp_imp_row` | ERP导入行明细(逐行导入结果) | 16 | ERPLG_ROW（ERP导入明细） |'
once(anchorRow, [
  anchorRow,
  '| `erp_integ_api` | ERP集成接口配置(2026-10-18):方向(导入/转出)+分类(基础资料/单据/设备)+接口地址+对应MES面板+启用/排序,种子照 KingdeePushService 现役推送口径实录 | 19 | ERP_INTEG（ERP集成配置清单,页面级虚拟面板） |',
  '| `erp_integ_device` | ERP集成设备绑定(2026-10-18):接口×设备(设备编码取 `bs_equip`),带用途(产量采集/点检对象/保养对象/数据来源) | 11 | ERP_INTEG（同上,「对应设备」页签） |',
  '| `erp_integ_field` | ERP集成字段映射(2026-10-18):一行 = MES字段/常量 → 金蝶接口字段,带映射层级(表头/明细/档案/常量)/转换规则/必填 | 16 | ERP_INTEG（同上,「字段映射」页签） |',
].join(NL), '§八 新增 3 行')

const row = [
  '| v3.41 | 2026-10-18 | **新增 ERP 集成配置三张表 + 导航一级目录「ERP系统集成」**(用户口径「在系统左侧菜单写一个 erp 系统集成的目录,目录下把 erp 导入日志移动到他下方;再写一个 erp 集成配置清单,分为导入与转出两种面板,每个面板再分类,把 api 接口、对应的设备、字段间的映射,做成一个可视化、可以统一配置编辑的面板」;`migrate-erp-integ-config-20261018.sql`)。① **建表 3 张**(本章 5 → **8 张**):`erp_integ_api`(**19 列** = 方向/分类/接口编码/接口名称/提供方/接口地址/请求方式/对应面板/目标对象/触发方式/启用/排序/说明 + id + 审计五件套)/ `erp_integ_field`(**16 列** = 接口编码/方向/序号/映射层级/MES字段/ERP字段/转换规则/是否必填/启用/备注 + id + 审计五件套)/ `erp_integ_device`(**11 列** = 接口编码/设备编码/设备名称/设备用途/备注 + id + 审计五件套);唯一索引 `ux_erp_integ_api_code` + 两张按接口编码的查询索引,表/关键列全部 `MS_Description` 中文注明,已登记 `tools/db-inuse-tables.txt`。② **面板归属**:ERP导入日志 `ERPLG`/`ERPLG_ROW` 的 `category`/`module_group` 由「数据建模」改为 **「ERP系统集成」**,菜单从「数据建模 / ERP集成」整组迁出——数据建模只余 字段管理 / 数据字典(**无面板/字段/权限行删除**,只换导航位置与归属)。新页面 = **页面级虚拟面板 `ERP_INTEG`**(`PagePanelRegistry`,动作只有 view/save),数据源就是这 3 张配置表,故**不插 yj_panel 行**(不污染报表/选单/字段配置等 `registry.all()` 下游)。③ **种子=现役口径实录**:转出 7 张单据(采购订单/采购入库/销售出库/材料出库/产品入库/其他入库/其他出库)的接口地址与字段名逐条照 `KingdeePushService` 现役代码;导入 5 条(商品/仓库/计量单位/职员/部门)是转出取 ID 时**实际在拉**的金蝶档案接口,采购订单/销售订单导入用 `pur_order(_detail)`/`sal_order(_detail)`;金蝶侧未开通或未实测的(供应商/客户档案、设备台账、保养计划、供应商/客户/商品推送、报工/点检转出)**一律 启用=0 并在说明里写明原因**——配置界面不假装那些接口能用。共 23 条接口 / 165 行字段映射 / 14 行设备绑定(设备取 `bs_equip` 现存 SB001..SB006 去重未停用)。④ **权限**:`PanelPermissionService` 增词 `save`(配置保存)与覆盖项 `ERP_INTEG|保存配置`,读按 `view`;写落 `yj_role_panel`,与订单结转等看板同一套机制。⑤ **验证**:两账套 `DbSync` 均 `[执行 1、失败 0]`;`tools/archive/_erp-integ-20261018/_v-erp-integ.mjs`(接口 23/11/12、映射 ≥150、设备 6 台、写闭环「新增→存映射→存设备→读回→删除」、界面两张截图、en/ja 界面文案全译文)**34/34 全过**;`menus.test.js` 19/19。⚠ 本行手写(理由同 v3.31:生成器会覆盖本节);全局在册总数以 `db-inuse-tables.txt` 实点与体检脚本为准(并行会话同期另有新增表,本次不代其改算总数) |',
].join('')

// ⚠ 插在 v3.42 行**之前**(不是插在文末的「行号说明」之前):并行会话的 v3.42 是同一批提交里
//   后写的,若把 v3.41 插在它后面,两次 diff 都会出现「整行换位」的假改动。
const anchorNote = '| v3.42 | 2026-10-18 |'
once(anchorNote, row + NL + anchorNote, '附录 维护记录 v3.41 行')

fs.writeFileSync(out, t, 'utf8')
console.log(`[OK] 写出 ${out}(${t.length} 字符,换行=${crlf ? 'CRLF' : 'LF'})`)
