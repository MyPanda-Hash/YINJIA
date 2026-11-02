-- 不合格报告(制程) QC_BHG 取证:两处报障涉及的字段元数据(只读查询,不改库)
-- 用法(在 tools 目录):
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
--     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10" yinjia env _probe-qc-bhg-20261102\qc-bhg-field-metadata.sql
-- 结论(2026-11-02 实测,两账套一致):
--   · 填写部门 = 参照(DEPT/部门名称),editable=1 → 纸面上是「点击选择」框
--   · 填写人   = 文本,editable=0       → 纯落款:用户不可改、save() 剥离入参
--   · 单据日期 = 日期,editable=1       → 右上「填写日期」那格
SET NOCOUNT ON;

SELECT panel_code, col_name, label, data_type, place, editable, hidden, visible, ref_panel, ref_field
FROM yj_field
WHERE panel_code = 'QC_BHG'
ORDER BY seq, id;

-- 表结构:填写人 与 底部「编制」是同一列
SELECT c.name AS col, t.name AS typ, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('qc_bhg')
  AND c.name IN (N'单据编号', N'单据日期', N'填写部门', N'填写人', N'审核人', N'审批人')
ORDER BY c.column_id;
