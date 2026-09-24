/* 采购入库单仓库列/字段整体修复(重放事故后):
   pin-wh-unify 在改名终态的库上重放,把正名 [仓库] 列当旧列 DROP,且自检裸引用编译失败中途弃,
   PURCHASE_IN 字段行也被清。本脚本按**终态口径**直接重建:
   ① bl_purchase_in 补 [仓库] 列,数据从快照两列合并复原(旧仓库 209 + 旧仓库名称 12 - 重叠 = 216);
   ② yj_field 补 PURCHASE_IN.仓库 明细行(参照 WH/必填/可见,正名终态);
   ③ SO_ORDER.仓库(隐藏行)required 降 0,防隐藏必填拦保存。 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
IF COL_LENGTH('dbo.bl_purchase_in', N'仓库') IS NULL
    ALTER TABLE bl_purchase_in ADD [仓库] nvarchar(1000) NULL;
GO
UPDATE t SET t.[仓库] = ISNULL(NULLIF(s.[仓库], N''), NULLIF(s.[仓库名称], N''))
  FROM bl_purchase_in t JOIN HSDZ_MES_RESTORE.dbo.bl_purchase_in s ON s.[单据编号] = t.[单据编号] AND s.id = t.id
 WHERE ISNULL(t.[仓库], N'') = N'';
SELECT COUNT(*) AS 仓库非空行 FROM bl_purchase_in WHERE ISNULL([仓库], N'') <> N'';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'PURCHASE_IN', N'仓库', N'仓库', N'参照', NULL, 'WH', N'仓库名称', N'仓库名称', N'detail', 200, 140, 1, 1, 0, 1;
UPDATE yj_field SET required = 0 WHERE panel_code='SO_ORDER' AND col_name=N'仓库' AND hidden = 1;
SELECT panel_code, col_name, place, data_type, ref_panel, required, hidden FROM yj_field
 WHERE col_name = N'仓库' AND panel_code IN ('PURCHASE_IN','SALE_OUT','SO_ORDER');
GO
