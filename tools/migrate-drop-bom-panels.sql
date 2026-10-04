-- migrate-drop-bom-panels.sql
-- 下架 MES 自建「物料清单(BOM)」面板族 —— 用户 2026-10-04 追加要求「要删」(上一轮已删金蝶镜像用的 BOM单)。
--
-- 为什么整族一起下架(依赖关系,不是顺手扩大范围):
--   · 面板 `BOM`「物料清单」= 单表平铺 `bs_bom`(父件-子件-定额数量,81 行演示数据);
--   · 视图 `v_wo_kit`(工单齐套)= **完全由 bs_bom 派生**(bs_bom × 工单行 × 库存),bs_bom 一删它必然失效;
--   · 面板 `WO_KIT`「工单齐套表」= 报表面板,唯一数据源就是 v_wo_kit(26 字段、当前 496 行)
--     ⇒ 三者是同一条链,删表就必须连视图与报表一起下架(否则体检 06 项"面板指向不存在的对象"、打开即 500)。
--   · 后端 5 处读 bs_bom 的代码(领料带料/采购申请/工单BOM明细/排产/二维码批次)同期在原文件里删除。
--
-- 不动的东西:
--   · `WLBOM`「物料清单」面板(表 `mate`,0 行,经典遗留,module_group=生产管理)—— 与本次无关,保持原样;
--   · `RD_ASM_BOM`「组装BOM表」(研发管理,自建 rd_asm_bom_head/detail)—— 另一个业务对象,保持原样;
--   · 多语言按"仍被引用则保留"处理:面板名「物料清单」两个面板同名(WLBOM 还在用)⇒ 译名保留。
--
-- 幂等;两账套都要执行。要恢复:见文件末尾说明(git 历史 + 本脚本的逆操作)。
SET NOCOUNT ON;

-- ══════════ 1. 面板元数据(BOM / WO_KIT) ══════════
DECLARE @f int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code IN ('BOM', 'WO_KIT'));
DECLARE @p int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN ('BOM', 'WO_KIT'));
DELETE FROM dbo.yj_field WHERE panel_code IN ('BOM', 'WO_KIT');
DELETE FROM dbo.yj_panel WHERE panel_code IN ('BOM', 'WO_KIT');
PRINT N'[' + DB_NAME() + N'] 删面板元数据:yj_field ' + CAST(@f AS nvarchar(10)) + N' 行,yj_panel ' + CAST(@p AS nvarchar(10)) + N' 行(BOM + WO_KIT)';
GO

-- ══════════ 2. 多语言(仅删"已无面板引用"的) ══════════
-- 面板名:同名面板还有 WLBOM ⇒ 不删(下面这条按其名是否仍被某面板使用来决定)
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_name = N'物料清单')
    DELETE FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'物料清单';
GO
DECLARE @k nvarchar(200), @sql nvarchar(max), @n int = 0;
DECLARE tr CURSOR LOCAL FAST_FORWARD FOR
  SELECT k FROM (VALUES
    (N'物料清单编码'), (N'父件编码'), (N'父件名称'), (N'虚拟件'), (N'默认BOM'),
    (N'子件编码'), (N'子件名称'), (N'子件计量单位'), (N'定额数量'), (N'需用数量'),
    (N'生产数量'), (N'预入仓库'), (N'物料种类'), (N'物料规格'), (N'外观要求'),
    (N'工单号'), (N'交期'), (N'订单数量'), (N'子件规格'), (N'单件用量'), (N'需求数量'), (N'库存结余'), (N'齐套缺口')
  ) v(k);
OPEN tr;
FETCH NEXT FROM tr INTO @k;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.label = @k)
  BEGIN
    SET @sql = N'DELETE FROM dbo.yj_translation WHERE scope = ''field'' AND ref_key = N''' + REPLACE(@k, '''', '''''') + N''';';
    EXEC sp_executesql @sql;
    SET @n = @n + @@ROWCOUNT;
  END
  FETCH NEXT FROM tr INTO @k;
END
CLOSE tr;
DEALLOCATE tr;
PRINT N'[' + DB_NAME() + N'] 删本族字段译名 ' + CAST(@n AS nvarchar(10)) + N' 条(仍被其它面板引用的一律保留)';
GO

-- ══════════ 3. 视图与表 ══════════
DECLARE @r int = 0;
IF OBJECT_ID(N'dbo.v_wo_kit') IS NOT NULL BEGIN SELECT @r = COUNT(*) FROM dbo.v_wo_kit; DROP VIEW dbo.v_wo_kit; END
DECLARE @b int = 0;
IF OBJECT_ID(N'dbo.bs_bom') IS NOT NULL SELECT @b = COUNT(*) FROM dbo.bs_bom;
PRINT N'[' + DB_NAME() + N'] 删除前数据量:v_wo_kit ' + CAST(@r AS nvarchar(10)) + N' 行,bs_bom ' + CAST(@b AS nvarchar(10)) + N' 行';
IF OBJECT_ID(N'dbo.bs_bom') IS NOT NULL DROP TABLE dbo.bs_bom;
GO

-- ══════════ 4. 自检 ══════════
DECLARE @left int =
    (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code IN ('BOM', 'WO_KIT'))
  + (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code IN ('BOM', 'WO_KIT'))
  + CASE WHEN OBJECT_ID(N'dbo.bs_bom') IS NULL THEN 0 ELSE 1 END
  + CASE WHEN OBJECT_ID(N'dbo.v_wo_kit') IS NULL THEN 0 ELSE 1 END;
PRINT N'[' + DB_NAME() + N'] 残留项 = ' + CAST(@left AS nvarchar(10)) + N'(应为 0)';
IF @left <> 0 RAISERROR(N'物料清单(BOM)下架未清干净', 16, 1);
GO
