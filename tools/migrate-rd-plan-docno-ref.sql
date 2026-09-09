/* ============================================================
   项目实施计划「文档编号」改参照立项申请(2026-09-09)
   业务:项目实施计划纸张右上角编号引用立项申请表右上角编号
        (RD_APPROVAL.文档编号),与数据记录表同一口径。
   背景:该字段原为手填(hidden=1 且列上带模板号 DEFAULT 'YJ-XS002'),
        参照化后必须可见(否则不进 headerFields,参照控件不渲染),
        必填前必须删默认值(否则新单已有值,校验跑不到)。
   范围:RD_PLAN
   幂等:条件 UPDATE / 条件 DROP CONSTRAINT,可重复执行。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-rd-plan-docno-ref.sql
   ============================================================ */
SET NOCOUNT ON;
GO

UPDATE yj_field
SET data_type = N'参照', ref_panel = N'RD_APPROVAL', ref_field = N'文档编号', display_field = N'文档编号', dict_sql = NULL
WHERE panel_code = N'RD_PLAN'
  AND col_name = N'文档编号'
  AND (ISNULL(ref_panel, N'') <> N'RD_APPROVAL'
       OR ISNULL(ref_field, N'') <> N'文档编号'
       OR ISNULL(display_field, N'') <> N'文档编号');
GO

/* 取消隐藏:隐藏字段不进 headerFields,纸张右上角只会渲染普通输入框 */
UPDATE yj_field
SET hidden = 0
WHERE panel_code = N'RD_PLAN' AND col_name = N'文档编号' AND hidden = 1;
GO

/* 必填:项目实施计划必须挂到某个立项项目上 */
UPDATE yj_field
SET required = 1
WHERE panel_code = N'RD_PLAN' AND col_name = N'文档编号' AND required = 0;
GO

/* 去掉模板号默认值:否则新单右上角一开始就是 YJ-XS002,必填校验形同虚设 */
DECLARE @drop nvarchar(max) = N'';
SELECT @drop += N'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(dc.parent_object_id))
              + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE c.name = N'文档编号' AND OBJECT_NAME(dc.parent_object_id) = 'rd_plan';
IF @drop <> N'' EXEC sp_executesql @drop;
GO

SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field, hidden, required
FROM yj_field WHERE panel_code = N'RD_PLAN' AND col_name = N'文档编号';
GO
