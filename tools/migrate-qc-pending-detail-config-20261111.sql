/* ============================================================================
 * migrate-qc-pending-detail-config-20261111.sql
 * 检验数据记录明细表:默认只列「已完成检验」+ 表头查询条件区默认收起
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11 第二轮):
 *   ①「还有要默认不显示正在检验中的。只显示已完成检验的。只有勾选后才显示出来
 *      (查询也是一样,没勾选之前查询不出来。)」
 *   ②「表头做个收缩」
 *
 * 做法 = 两行配置(声明式,**不加任何面板专属代码路径**),yj_panel.config:
 *   {"statusGate":{"field":"检验状态","value":"已完成检验"},
 *    "collapseQueryBar":true}
 *
 *   · statusGate —— 服务端**状态闸门**:QueryService.queryFlat 读它,列表取数默认追加
 *     `AND t.[检验状态] = '已完成检验'`;前端那颗复选框勾上才带 condition._statusScope='all'
 *     把闸门放开。**闸门在服务端**,所以查询弹窗 / 关键字 / 高级筛选 / 翻页 / 导出
 *     都拿不到「正在检验中」的行 —— 正是用户说的「没勾选之前查询不出来」。
 *     解析与消费见 PanelRegistry.PanelDef.statusGate() / PanelConfigService(下发 metadata)。
 *   · collapseQueryBar —— 前端把内联查询条件区**默认收起**,工具栏留一个「展开条件/收起条件」开关。
 *
 * 幂等:整体覆盖 config(该面板 config 本来只有这两项,本脚本就是它的唯一真源);
 *       已登记 `db-migrations.txt`,两账套执行(先正式、后测试)。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-pending-detail-config-20261111 ==';

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL')
    RAISERROR(N'[配置] 面板 QC_INSP_REC_DETAIL 不存在 —— 请先执行 migrate-qc-pending-detail-20261111.sql', 16, 1);

UPDATE yj_panel
   SET config = N'{"statusGate":{"field":"检验状态","value":"已完成检验"},"collapseQueryBar":true}'
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND ISNULL(config, N'') <> N'{"statusGate":{"field":"检验状态","value":"已完成检验"},"collapseQueryBar":true}';
PRINT N'[配置] QC_INSP_REC_DETAIL.config 更新 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(幂等)';
GO

/* 自检:两项声明都必须解析得出来(配置写坏 = 闸门静默失效,必须有闸) */
DECLARE @bad int = 0;
IF (SELECT config FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL') NOT LIKE N'%"statusGate"%' SET @bad = @bad + 1;
IF (SELECT config FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL') NOT LIKE N'%"collapseQueryBar":true%' SET @bad = @bad + 1;
-- 闸门字段必须真的在该面板 yj_field 里登记(否则 QueryService 拼不出列 → 闸门不生效)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' AND label = N'检验状态') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'状态闸门/查询区收起 配置自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 检验数据记录明细表:默认只列「已完成检验」+ 条件区默认收起';
GO

SELECT panel_code, panel_name, config FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL';
GO
