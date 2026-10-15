-- 一次性探针:组装成品检验单(QC_ASM_INSP)可取「出货检验计划」的字段对齐取证
-- 跑法(在 tools/archive 下):$env:YINJIA_SQL_PASS='Yinjia@2026'
--   java -cp ".;..\lib\mssql-jdbc.jar" _q _q-asm-insp-ship-plan.sql HSDZ_MES _q-asm-insp-ship-plan.out

-- ① QC_ASM_INSP 明细字段(现役 yj_field)
SELECT col_name, label, data_type, place, seq, visible, hidden
FROM dbo.yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%detail%'
ORDER BY seq, id;

-- ② qc_asm_insp_detail 物理列(非备用列)
SELECT c.name AS col, t.name AS type, c.max_length/2 AS chars
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_detail') AND c.name NOT LIKE N'备用%'
ORDER BY c.column_id;

-- ③ 出货检验计划表(QC_ASM_INSP 要取的源):哪些列真的有值
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL([控制项目],N'')<>N'' THEN 1 ELSE 0 END) AS 控制项目,
       SUM(CASE WHEN ISNULL([控制标准及要求],N'')<>N'' THEN 1 ELSE 0 END) AS 控制标准及要求,
       SUM(CASE WHEN ISNULL([控制方法],N'')<>N'' THEN 1 ELSE 0 END) AS 控制方法,
       SUM(CASE WHEN ISNULL([检测频率],N'')<>N'' THEN 1 ELSE 0 END) AS 检测频率,
       SUM(CASE WHEN ISNULL([检测仪器],N'')<>N'' THEN 1 ELSE 0 END) AS 检测仪器,
       SUM(CASE WHEN ISNULL([不合格应对措施],N'')<>N'' THEN 1 ELSE 0 END) AS 不合格应对措施,
       SUM(CASE WHEN ISNULL([检验内容],N'')<>N'' THEN 1 ELSE 0 END) AS 检验内容,
       SUM(CASE WHEN ISNULL([检验类别],N'')<>N'' THEN 1 ELSE 0 END) AS 检验类别
FROM dbo.rd_insp_plan_detail WHERE ISNULL(asp_cancel,'N')<>'Y';

-- ④ 出货检验计划表样本(看真实内容长什么样)
SELECT TOP 30 [单据编号], [检验类别], [序号], [控制项目], [控制标准及要求], [控制方法], [检测频率], [检验内容]
FROM dbo.rd_insp_plan_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY [单据编号], id;

-- ⑤ 计划表产品编号 ↔ 检验单产品编码能否对上
SELECT TOP 20 h.[单据编号], h.[产品编号], h.[标题], (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail d
        WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'N') AS 明细行
FROM dbo.rd_insp_plan_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC;

-- ⑥ 组装成品检验单现有明细(含表区,看带入后长什么样)
SELECT TOP 20 d.[单据编号], d.[表区], d.[检验项目], d.[检验要求], d.[检验方法], d.[检查频率], d.[结果判断]
FROM dbo.qc_asm_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
ORDER BY d.[单据编号] DESC, d.id;
