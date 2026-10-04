-- migrate-drop-bom-kingdee.sql
-- 下架「BOM单」面板(BOM_KD)及其两张表 —— 用户 2026-10-04 要求「删除本地基础资料的 bom 单面板,包括数据库」。
--
-- 背景:该面板 2026-10-04 当天建立(migrate-bom-kingdee.sql),建完实测金蝶账套 **一条 BOM 数据都没有**
--   (bd/bom 列表 0、bd/bom_query 抽样 306 商品全 0、pm/bom 接口 API not found),页面永远是空表,
--   用户决定先删掉。**代码未丢**:建表/同步/自检那一整套在 git 历史 commit `d6998ebd` 里,
--   等金蝶那边开通生产管理 BOM 接口或建了 BOM,一条 revert 即可恢复。
--
-- 本脚本做什么(全部幂等,重复执行 0 影响):
--   1) 删面板元数据:yj_field(panel_code='BOM_KD')、yj_panel(BOM_KD);
--   2) 删多语言:'panel' scope 的「BOM单」;以及本功能新增、且**已无任何面板字段引用**的 'field' 译名
--      (其它面板也在用的标签一律保留 —— yj_translation 是按标签全局共享的);
--   3) 删表:bs_bom_detail、bs_bom_head(先删明细表);
--   4) 自检:面板/字段/表都不复存在。
-- 注意:不动既有「物料清单」面板(BOM/bs_bom)与其视图 v_wo_kit —— 那是 MES 自己的模型,与本功能无关。
SET NOCOUNT ON;

-- ══════════ 1. 面板元数据 ══════════
DECLARE @f int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = 'BOM_KD');
DECLARE @p int = (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = 'BOM_KD');
DELETE FROM dbo.yj_field WHERE panel_code = 'BOM_KD';
DELETE FROM dbo.yj_panel WHERE panel_code = 'BOM_KD';
PRINT N'[' + DB_NAME() + N'] 删面板元数据:yj_field ' + CAST(@f AS nvarchar(10)) + N' 行,yj_panel ' + CAST(@p AS nvarchar(10)) + N' 行';
GO

-- ══════════ 2. 多语言 ══════════
DELETE FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'BOM单';
GO
DECLARE @k nvarchar(200), @sql nvarchar(max), @n int = 0;
DECLARE tr CURSOR LOCAL FAST_FORWARD FOR
  SELECT k FROM (VALUES
    (N'成品率'), (N'BOM备注'), (N'审核状态'), (N'是否启用'), (N'产品单位'), (N'产品单位编码'),
    (N'基本单位'), (N'材料用量'), (N'产品产量'), (N'单位用量'),
    (N'属性组1'), (N'属性组2'), (N'属性组3'), (N'属性组4'), (N'属性组5'),
    (N'跳过该层级领用下级物料'),
    (N'子料编码'), (N'子料名称'), (N'子料单位'), (N'子料基本单位'),
    (N'固定损耗'), (N'发料方式'), (N'关键件'), (N'替代件'), (N'工位'),
    (N'发料仓库'), (N'发料仓库编码'), (N'发料仓位'), (N'发料仓位编码'),
    (N'物料备注'), (N'物料备注1'), (N'物料备注2'), (N'物料备注3')
  ) v(k);
OPEN tr;
FETCH NEXT FROM tr INTO @k;
WHILE @@FETCH_STATUS = 0
BEGIN
  -- 只有「其它面板也没有这个标签」时才删译名(同标签全局共享,误删会影响别的面板)
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
PRINT N'[' + DB_NAME() + N'] 删本功能字段译名 ' + CAST(@n AS nvarchar(10)) + N' 条(仍被其它面板引用的一律保留)';
GO

-- ══════════ 3. 两张表 ══════════
DECLARE @h int = 0, @d int = 0;
IF OBJECT_ID(N'dbo.bs_bom_head') IS NOT NULL SELECT @h = COUNT(*) FROM dbo.bs_bom_head;
IF OBJECT_ID(N'dbo.bs_bom_detail') IS NOT NULL SELECT @d = COUNT(*) FROM dbo.bs_bom_detail;
PRINT N'[' + DB_NAME() + N'] 删表前数据量:bs_bom_head ' + CAST(@h AS nvarchar(10)) + N' 行,bs_bom_detail ' + CAST(@d AS nvarchar(10)) + N' 行';
IF OBJECT_ID(N'dbo.bs_bom_detail') IS NOT NULL DROP TABLE dbo.bs_bom_detail;
IF OBJECT_ID(N'dbo.bs_bom_head') IS NOT NULL DROP TABLE dbo.bs_bom_head;
GO

-- ══════════ 4. 自检 ══════════
DECLARE @left int =
    (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = 'BOM_KD')
  + (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = 'BOM_KD')
  + (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'BOM单')
  + CASE WHEN OBJECT_ID(N'dbo.bs_bom_head') IS NULL THEN 0 ELSE 1 END
  + CASE WHEN OBJECT_ID(N'dbo.bs_bom_detail') IS NULL THEN 0 ELSE 1 END;
PRINT N'[' + DB_NAME() + N'] 残留项 = ' + CAST(@left AS nvarchar(10)) + N'(应为 0)';
IF @left <> 0 RAISERROR(N'BOM单下架未清干净', 16, 1);
GO
