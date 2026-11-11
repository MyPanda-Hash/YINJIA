/**
 * 检验数据记录明细表(QC_INSP_REC_DETAIL)—— 列表页专属呈现契约,**唯一真源**。
 *
 * 【这张表是什么】一行 = 一条检验数据记录(= 来料检验单的一行物料);
 * 后端视图 dbo.v_qc_insp_rec_detail 把整条采购链摊平在一行上,见
 * tools/migrate-qc-pending-detail-20261111.sql。面板是 flat 只读报表(yj_panel.page_size=50)。
 *
 * 【用户口径 2026-11-11】「另外做一个检验数据记录的明细表面版(可以查询)。每一条罗列的都要带
 * 来料检验单,也要带行号和检验数据记录。」「还有也要有采购订单,送料暂收单,采购入库单
 * (这3个的单号和行号,但是这个不用跳转,**只有上面两个才用**)。」
 *   ⇒ 只有「来料检验单号」「检验数据记录单号」渲染成可点跳转(与检验目录的 ↗ 同款:
 *      router.push('/panelx/list/<面板>?docNo=<单号>') 定位);
 *     采购订单 / 送料暂收单 / 采购入库单 三组只显示「单号 + 行号」,**不跳转**。
 *
 * 【为什么放在前端常量而不是 yj_panel.config】跳转目标 = 另一张面板的编码,
 * 属于前端路由知识(canViewPanel 权限项也按面板码走);写成一份常量比在
 * 14k 行的 PanelxList 里再散三处 if 更好查、更好改。
 */

/** 面板编码(与 yj_panel.panel_code 一致) */
export const QC_REC_DETAIL_PANEL = 'QC_INSP_REC_DETAIL'

/** 可点跳转的单号列(字段标签) → 目标面板编码 */
export const QC_REC_DETAIL_LINKS = Object.freeze({
  来料检验单号: 'QC_INSP',
  检验数据记录单号: 'QC_INSP_REC',
})

/**
 * 行内「取消完成」的取参列(视图里的两个隐藏列,visible=0 故不进表格)。
 *
 * 为什么要放在这张表上:待检验目录只显示「正在检验中」的行(2026-11-11 口径),
 * 「已完成检验」的行只剩这里看得到;而反审核挂靠单据(来料检验单/检验数据记录)的守卫
 * (QcCatalogService.assertLinkedRowNotCompleted)要求先「取消完成」把目录行回弹成正在检验中
 * ⇒ 该动作必须跟着已完成的行一起搬到这里,否则守卫变成死路。
 * 后端仍是 QC_CATALOG 的「修改」按钮(reopenCatalogRow),这里只是替它取行 id。
 */
export const QC_REC_DETAIL_REOPEN = Object.freeze({
  catalogPanel: 'QC_CATALOG',
  buttonName: '修改',
  docField: '目录单号',
  rowIdField: '目录行id',
  statusField: '检验状态',
  doneStatus: '已完成检验',
})
