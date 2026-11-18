SET NOCOUNT ON;
PRINT '=== INSP_COMMISSION 面板行 ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, module_group
  FROM yj_panel WHERE panel_code IN (N'INSP_COMMISSION', N'SAMPLE_REG');

PRINT '=== INSP_COMMISSION 字段(按 seq) ===';
SELECT label, col_name, data_type, place, seq, width, required, hidden, visible, ref_panel, ref_field, display_field, dict_sql, col_group
  FROM yj_field WHERE panel_code = N'INSP_COMMISSION' ORDER BY seq, id;

PRINT '=== 委托单头/行 行数 ===';
SELECT (SELECT COUNT(*) FROM qc_insp_commission_head) head_rows,
       (SELECT COUNT(*) FROM qc_insp_commission_detail) detail_rows;

PRINT '=== 头表最近 10 行 ===';
SELECT TOP 10 单据编号, 单据日期, 委托单位, 联系人, 样品名称, 样品数量, 检验类别, 合计收费, 单据状态, 审核人, asp_time1
  FROM qc_insp_commission_head ORDER BY id DESC;

PRINT '=== 行表最近 10 行 ===';
SELECT TOP 10 单据编号, 行号, 检测元素, 测试方法, 测试周期, 收费
  FROM qc_insp_commission_detail ORDER BY id DESC;

PRINT '=== 单据状态分布 ===';
SELECT 单据状态, COUNT(*) n FROM qc_insp_commission_head GROUP BY 单据状态;
GO
