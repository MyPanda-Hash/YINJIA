-- 只读探针:QC_ASM_INSP 表头字段布局(两账套各自) + 全库「（）」列名先例 + 入库单相关列
SET NOCOUNT ON;

PRINT N'[1] QC_ASM_INSP 表头字段(place 含 header,按 seq)';
SELECT seq, col_name, label, data_type, place, visible, hidden, editable, required
FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%header%' ORDER BY seq, id;

PRINT N'[2] 全库物理列名里带全角括号的先例';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.name
FROM sys.columns c WHERE c.name LIKE N'%（%' OR c.name LIKE N'%）%' ORDER BY tbl, c.name;

PRINT N'[3] 全库 yj_field 标签里带全角括号的先例(前十)';
SELECT TOP 10 panel_code, col_name, label FROM yj_field WHERE label LIKE N'%（%' ORDER BY panel_code;

PRINT N'[4] qc_asm_insp_head 列(含类型)';
SELECT c.column_id, c.name, t.name AS type, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_asm_insp_head') ORDER BY c.column_id;

PRINT N'[5] 已有的 QC_ASM_INSP → FINISH_IN 占用链(取样)';
SELECT TOP 10 source_form_no, target_form_no, link_status, create_time
FROM form_flow_link WHERE source_panel_code = N'QC_ASM_INSP' ORDER BY id DESC;

PRINT N'[6] 「合格数量」相关字段在各面板的登记(含已注销的物理列)';
SELECT panel_code, col_name, label, data_type, place, seq, visible, hidden, required
FROM yj_field WHERE col_name LIKE N'%合格数量%' OR label LIKE N'%合格数量%' ORDER BY panel_code, seq;
