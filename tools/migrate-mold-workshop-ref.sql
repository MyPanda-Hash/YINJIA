/* ============================================================
   成型面板「生产车间」关联部门(2026-09-09)
   1) 部门档案:把参照项目遗留的 4 个金属加工车间名改为银嘉实际车间名
      (D05 熔铸车间→1#车间 / D06 轧制车间→2#车间 / D07 精整车间→3#车间 / D08 测试车间→4#车间)
      并补 部门类型='车间'(2026-09-09 新增字段)
   2) 成型工艺清单 / 成型配方 的「生产车间」由硬编码下拉改为参照 DEPT
   幂等:条件 UPDATE,可重复执行。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-mold-workshop-ref.sql
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 部门档案:修正遗留车间名 + 标记类型 ---------- */
UPDATE bs_dept SET 部门名称 = N'1#车间' WHERE 部门编码 = 'D05' AND 部门名称 = N'熔铸车间';
UPDATE bs_dept SET 部门名称 = N'2#车间' WHERE 部门编码 = 'D06' AND 部门名称 = N'轧制车间';
UPDATE bs_dept SET 部门名称 = N'3#车间' WHERE 部门编码 = 'D07' AND 部门名称 = N'精整车间';
UPDATE bs_dept SET 部门名称 = N'4#车间' WHERE 部门编码 = 'D08' AND 部门名称 = N'测试车间';
GO

UPDATE bs_dept SET 部门类型 = N'车间'
WHERE 部门编码 IN ('D05','D06','D07','D08') AND ISNULL(部门类型, N'') = N'';
GO

/* ---------- 2. 成型两面板「生产车间」改参照部门 ---------- */
UPDATE yj_field
SET data_type = N'参照', ref_panel = N'DEPT', ref_field = N'部门编码', display_field = N'部门名称', dict_sql = NULL
WHERE panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA')
  AND col_name = N'生产车间'
  AND ISNULL(ref_panel, N'') <> N'DEPT';
GO

/* ---------- 3. 校验输出 ---------- */
SELECT 部门编码, 部门名称, ISNULL(部门类型, N'(空)') AS 部门类型 FROM bs_dept WHERE 部门编码 IN ('D05','D06','D07','D08');
SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field
FROM yj_field WHERE panel_code IN ('RD_MOLD_PROC','RD_MOLD_FORMULA') AND col_name = N'生产车间';
GO
