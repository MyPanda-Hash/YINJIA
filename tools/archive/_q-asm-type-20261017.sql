-- 【只读】组装成品检验单 QC_ASM_INSP:面板元数据 + 明细字段(含隐藏列) + 表区分布
SET NOCOUNT ON;

PRINT N'=== ① yj_panel(QC_ASM_INSP) ===';
SELECT panel_code, panel_name, mode, line_table, head_table, ISNULL(detail_key,N'') AS detail_key, ISNULL(config,N'') AS config
FROM yj_panel WHERE panel_code = N'QC_ASM_INSP';

PRINT N'=== ② yj_field(QC_ASM_INSP):id/seq/place/tab_key/visible/hidden/col_name/label/alias ===';
SELECT id, seq, place, ISNULL(tab_key,N'') AS tab_key, visible, hidden, col_name, label, ISNULL(alias,N'') AS alias, data_type, editable
FROM yj_field WHERE panel_code = N'QC_ASM_INSP'
ORDER BY place, seq, id;

PRINT N'=== ③ 全库「检验类型」字段(任意面板) ===';
SELECT panel_code, seq, place, ISNULL(tab_key,N'') AS tab_key, visible, hidden, col_name, label
FROM yj_field WHERE label = N'检验类型' OR col_name = N'检验类型' ORDER BY panel_code, seq;

PRINT N'=== ④ qc_asm_insp_detail 物理列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_asm_insp_detail') ORDER BY c.column_id;

PRINT N'=== ⑤ 单据 ZJ-2026-10-0058 明细 ===';
SELECT 行号, 表区, 检验项目, 检验要求, 检验方法, 检验结果, 测量值1, 测量值2, 结果判断, ISNULL(asp_cancel,N'N') AS cancel_flag
FROM qc_asm_insp_detail WHERE 单据编号 = N'ZJ-2026-10-0058' ORDER BY id;

PRINT N'=== ⑥ 近 10 张组装成品检验单的表区分布 ===';
SELECT TOP 40 单据编号, 表区, COUNT(*) AS rows_cnt
FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,N'N') <> N'Y'
GROUP BY 单据编号, 表区 ORDER BY 单据编号 DESC, 表区;

PRINT N'=== ⑦ C-84-02 的出货检验计划明细 ===';
SELECT TOP 60 h.单据编号, d.检验类别, d.序号, d.控制项目, d.质量控制内容, ISNULL(d.控制标准及要求,N'') AS req, ISNULL(d.控制方法,N'') AS method, ISNULL(d.检测频率,N'') AS freq, ISNULL(d.检验内容,N'') AS 检验内容
FROM rd_insp_plan_head h JOIN rd_insp_plan_detail d ON d.单据编号 = h.单据编号
WHERE h.产品编号 = N'C-84-02'
ORDER BY h.单据编号 DESC, d.序号;

PRINT N'=== ⑧ 组装成品检验单字段总数统计 ===';
SELECT place, COUNT(*) AS cnt FROM yj_field WHERE panel_code = N'QC_ASM_INSP' GROUP BY place ORDER BY place;
