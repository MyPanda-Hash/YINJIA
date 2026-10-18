/* _q-state.sql —— 首件检验单(QC_FIRST_INSP)审核功能:现状只读取证
 * 用法(在 tools 目录下):
 *   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
 *     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env ^
 *     archive\_first-insp-audit-20261018\_q-state.sql
 */
SET NOCOUNT ON;

PRINT N'-- 1) 面板登记 / 角色授权(与 QC_PROC_INSP 并排)';
SELECT panel_code, panel_name, mode, line_table, head_table, group_col, code_col, config
FROM yj_panel WHERE panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP');

SELECT rp.panel_code, COUNT(*) AS role_rows, MIN(rp.can_approve) AS can_approve_min,
       MIN(rp.perms) AS perms_sample
FROM yj_role_panel rp WHERE rp.panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP')
GROUP BY rp.panel_code;

PRINT N'-- 2) 单据状态分布(yj_doc_status)';
SELECT panel_code, status = CASE
         WHEN ISNULL(canceled, N'N') = N'Y' THEN N'已作废'
         WHEN ISNULL(pending, N'N') = N'Y' THEN N'审批中'
         WHEN ISNULL(shr, N'') <> N'' THEN N'已审核'
         ELSE N'草稿' END,
       COUNT(*) AS rows_cnt
FROM yj_doc_status WHERE panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP')
GROUP BY panel_code, CASE
         WHEN ISNULL(canceled, N'N') = N'Y' THEN N'已作废'
         WHEN ISNULL(pending, N'N') = N'Y' THEN N'审批中'
         WHEN ISNULL(shr, N'') <> N'' THEN N'已审核'
         ELSE N'草稿' END
ORDER BY panel_code, rows_cnt DESC;

PRINT N'-- 3) 已审核但无 AUDIT 留痕的首件检验单(补录迁移的目标行)';
SELECT TOP 20 s.doc_no, s.shr, s.shsj, s.update_at
FROM yj_doc_status s
WHERE s.panel_code = N'QC_FIRST_INSP'
  AND ISNULL(s.shr, N'') <> N''
  AND ISNULL(s.canceled, N'N') <> N'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_form_approval a
                  WHERE a.panel_code = N'QC_FIRST_INSP' AND a.form_no = s.doc_no AND a.action = N'AUDIT');

PRINT N'-- 4) 审批留痕现状(两面板并排)';
SELECT panel_code, action, result, COUNT(*) AS rows_cnt
FROM yj_form_approval WHERE panel_code IN (N'QC_FIRST_INSP', N'QC_PROC_INSP')
GROUP BY panel_code, action, result ORDER BY panel_code, action, result;

PRINT N'-- 5) 首件检验单表头行数 + 状态行数';
SELECT head_rows = (SELECT COUNT(*) FROM qc_first_insp_head),
       status_rows = (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = N'QC_FIRST_INSP'),
       detail_rows = (SELECT COUNT(*) FROM qc_first_insp_detail);
