-- migrate-qc-insp-req-custom-tab.sql — 来料检验要求(QC_INSP_REQ)新增页签「自定义检验要求」
--
-- 用户口径(2026-10-04):「我想在来料检验要求加一个 tab 表,这个表可以自定义字段的,
--   这样的表能不能也实现带入到检验数据记录」—— 能,且**复用既有机制**,不新造一套:
--   · 页签 = 物料类别 的一个字典值('自定义检验要求');行仍存同一张宽表 qc_insp_req
--     ⇒ 天然按 物料编号 参与匹配,检验报告的「带入检验要求」逻辑原样复用(见 core/qc/qcInspReqCarry.js);
--   · 该页签的列 = 绑定到本面板的**动态字段**(备用1..20,管理员在「自定义字段」里加,
--     零 DDL;备用列池已在位 —— 本库实测 qc_insp_req 共 59 列、其中 20 个备用列);
--   · 带入规则与现有 7 张表完全一致:每一列 → 报告一行,**检验项 = 该列中文名(label)**、
--     检测标准 = 命中行该列的数据,空数据列不带。
--
-- 本脚本只做一件事:把新页签名加进「物料类别」字典词表(整串幂等重建,不做字符串追加,避免脏值)。
-- 幂等:已含「自定义检验要求」或字段不存在 ⇒ 跳过。
-- 运行(tools 目录):
--   正式库 java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-custom-tab.sql
--   测试库 YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-qc-insp-req-custom-tab.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
DECLARE @dict nvarchar(500) = N'SELECT v FROM (VALUES (N''折叠棉''),(N''垫片''),(N''无纺布''),(N''网套''),(N''PP管''),(N''端盖''),(N''PP棉''),(N''自定义检验要求'')) AS t(v)';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别')
  PRINT N'[跳过] 未找到 QC_INSP_REQ.物料类别 字段(面板未注册?)';
ELSE IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别' AND ISNULL(dict_sql, N'') LIKE N'%自定义检验要求%')
  PRINT N'[跳过] 物料类别 词表已含「自定义检验要求」';
ELSE
BEGIN
  UPDATE yj_field SET dict_sql = @dict WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别';
  PRINT N'[OK] 物料类别 词表已加「自定义检验要求」(7 张固定表 + 1 张自定义表 = 8 个页签)';
END
GO

-- ═════════════ 自检 ═════════════
SELECT N'物料类别词表' AS k, dict_sql FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别';
SELECT N'含自定义页签名' AS k, CASE WHEN dict_sql LIKE N'%自定义检验要求%' THEN 1 ELSE 0 END AS ok
  FROM yj_field WHERE panel_code = 'QC_INSP_REQ' AND col_name = N'物料类别';
SELECT N'自定义页签存活行数' AS k, COUNT(*) AS n FROM qc_insp_req
 WHERE 物料类别 = N'自定义检验要求' AND ISNULL(asp_cancel, 'N') <> 'Y';
SELECT N'qc_insp_req 备用列数' AS k, COUNT(*) AS n FROM sys.columns
 WHERE object_id = OBJECT_ID('qc_insp_req') AND name LIKE N'备用%';
GO
