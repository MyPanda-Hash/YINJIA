-- ============================================================================
-- 组装物料清单(ASM_BOM):产品编码改为可手输 + 工序列移出表头(默认「组装」)(2026-11-04 晚)
--
-- 用户口径(2026-11-04 18:34 截图,两处红框):
--   ①「这个产品编码要可以自己编辑」—— 目前产品编码是「参照存货档案(INV)」,
--      只能弹窗/下拉选;现场需要直接手输产品编码(有些编码不在存货档案,或手输更快)。
--   ②「且当前的工序都为组装的bom不需要设定工序了」—— 工序目前是表头必填下拉(组装/成型/切炭),
--      而现有 BOM 全部是「组装」、新建也只会是组装 ⇒ 表头不再让用户选工序。
--
-- 本脚本 = **只改元数据 + 回填占位行脏数据**,零 DDL、不改面板形态、不增删字段:
--   §1 产品编码:data_type 参照 → 文本;清空 ref_panel / ref_field / display_field
--      (editable=1、required=1 保留 —— 改成「手输但必填」)。
--   §2 工序:place 'query,header' → 'query'(从表头网格移除,**保留查询条件**);
--      editable 1 → 0、required 1 → 0。
--      为什么不是 hidden=1:place 里去掉 header 才会同时从表头网格与 frontend 必填校验里消失,
--      而 place 仍含 query ⇒ 「查询」弹窗还能按工序筛选(将来成型/切炭同表追加时有用)。
--   §3 yj_panel.config.headDefaults 增加 "工序":"组装" ⇒ 新建 BOM 自动写 工序=组装
--      (与现有 "状态":"启用" 同一机制:ButtonService.putHeadDefaults 建单时按 label→实际列写入)。
--   §4 回填存量空工序:bs_asm_bom 里 工序 为空的行(当前 2 行,均为「新增」产生的空草稿占位行)写「组装」。
--
-- ⚠ 迁移顺序:本脚本必须排在 migrate-asm-bom-maintainable-20261104.sql **之后**
--   (那条把 产品编码 改成参照、把 工序 留在表头)。整链重放按清单顺序自然收敛到本设计;
--   但**不要单独重跑 maintainable 那条**,否则会把产品编码改回参照、把工序加回表头。
--   如后续要录「成型/切炭」BOM:把工序加回表头(place 含 header)或另开面板,别改本脚本。
--
-- 幂等:§1~§4 全部带「与目标值不同」的窄条件;重跑第二次影响 0 行。
-- 两账套:先正式 HSDZ_MES、后测试 HSDZ_MES_TEST,均在 tools 目录执行:
--   正式:java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-product-manual-20261104.sql
--   测试:$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-product-manual-20261104.sql
--
-- 自检(§6,不满足即 RAISERROR 16,DbSync 判 FAIL 并停链):
--   产品编码=文本且无参照配置;工序已不在任何 header place;config.headDefaults 含 状态=启用 + 工序=组装;
--   面板字段仍 19 行(不增删字段);bs_asm_bom 仍 47 列且 备注 列在;空工序行 = 0。
-- ⚠ 本脚本只用行注释,不写「斜杠 + 星号」相邻组合(2026-11-02 踩坑:T-SQL 块注释可嵌套)。
-- ============================================================================
SET NOCOUNT ON;
GO

-- ══════════ 0. 改前快照(只读) ══════════
PRINT N'== 0. 改前:ASM_BOM 表头字段 + 关键行(config/空工序行) ==';
SELECT DB_NAME() AS db_name, label, place, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       editable, required
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
 ORDER BY seq, id;
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM') AS panel_fields,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%') AS header_fields,
       (SELECT COUNT(*) FROM dbo.bs_asm_bom WHERE ISNULL(工序, N'') = N'') AS blank_proc_rows,
       (SELECT ISNULL(config, N'<NULL>') FROM yj_panel WHERE panel_code = 'ASM_BOM') AS panel_config;
GO

-- ══════════ 1. 产品编码:参照 → 文本(可手输,仍必填) ══════════
PRINT N'== 1. 产品编码:data_type 参照 -> 文本,清空参照配置 ==';
DECLARE @n1 int;
UPDATE yj_field
   SET data_type = N'文本', ref_panel = NULL, ref_field = NULL, display_field = NULL
 WHERE panel_code = 'ASM_BOM'
   AND label = N'产品编码'
   AND (ISNULL(data_type, N'') <> N'文本'
        OR ref_panel IS NOT NULL OR ref_field IS NOT NULL OR display_field IS NOT NULL);
SET @n1 = @@ROWCOUNT;
PRINT N'  影响行数(首次 1 / 重跑 0):' + CAST(@n1 AS nvarchar(10));
GO

-- ══════════ 2. 工序:移出表头(保留查询条件),不再必填/可编辑 ══════════
PRINT N'== 2. 工序:place query,header -> query;editable 1 -> 0;required 1 -> 0 ==';
DECLARE @n2 int;
UPDATE yj_field
   SET place = N'query', editable = 0, required = 0
 WHERE panel_code = 'ASM_BOM'
   AND label = N'工序'
   AND (place <> N'query' OR ISNULL(editable, 0) <> 0 OR ISNULL(required, 0) <> 0);
SET @n2 = @@ROWCOUNT;
PRINT N'  影响行数(首次 1 / 重跑 0):' + CAST(@n2 AS nvarchar(10));
GO

-- ══════════ 3. 新建默认值:yj_panel.config.headDefaults 增加 工序=组装 ══════════
PRINT N'== 3. yj_panel.config:headDefaults 增加 工序=组装(与 状态=启用 合并)==';
DECLARE @cfg nvarchar(max);
SELECT @cfg = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = N''
BEGIN
    UPDATE yj_panel
       SET config = N'{"headDefaults":{"状态":"启用","工序":"组装"}}'
     WHERE panel_code = 'ASM_BOM'
       AND (config IS NULL OR LTRIM(RTRIM(config)) = N'');
    PRINT N'  config 原为空,已整段写入(影响 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';
END
ELSE IF @cfg LIKE N'%headDefaults%'
BEGIN
    -- JSON_MODIFY 合并:已有键保留,只补/改 工序(中文键按 JSON 规范加双引号转义)
    UPDATE yj_panel
       SET config = JSON_MODIFY(config, N'$.headDefaults."工序"', N'组装')
     WHERE panel_code = 'ASM_BOM'
       AND ISNULL(JSON_VALUE(config, N'$.headDefaults."工序"'), N'') <> N'组装';
    PRINT N'  config 已有 headDefaults,合并 工序=组装(影响 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';
END
ELSE
    PRINT N'  !! config 已有其它内容但没有 headDefaults,未覆盖。请手工把 "headDefaults":{"工序":"组装"} 合并进该 JSON 后重跑(§6 自检会据此判 FAIL)。';
GO
PRINT N'== 3b. config 现状 ==';
SELECT panel_code, ISNULL(config, N'<NULL>') AS config
  FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO

-- ══════════ 4. 回填存量空工序(草稿占位行)== ══════════
-- 现状:236 张导入单全是「组装」;只有「新增」产生的空草稿占位行 工序=''(NOT NULL 列,insertRow 补 '' 而来)。
-- 这些行不允许再让用户去选工序 ⇒ 直接按现行唯一工序「组装」回填。
PRINT N'== 4. 回填 bs_asm_bom.工序 = 组装(空值行)==';
DECLARE @n4 int;
UPDATE dbo.bs_asm_bom
   SET 工序 = N'组装',
       asp_user2 = N'migrate-asm-bom-product-manual-20261104',
       asp_time2 = SYSDATETIME()
 WHERE ISNULL(工序, N'') = N'';
SET @n4 = @@ROWCOUNT;
PRINT N'  影响行数(首次 = 空工序行数 / 重跑 0):' + CAST(@n4 AS nvarchar(10));
GO

-- ══════════ 5. 改后对照 ══════════
PRINT N'== 5. 改后:ASM_BOM 表头字段(应无 工序;产品编码为文本可编辑)==';
SELECT label, place, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       editable, required
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
 ORDER BY seq, id;
GO
PRINT N'== 5b. 改后统计 ==';
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM') AS panel_fields,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%') AS header_fields,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序' AND place LIKE N'%header%') AS proc_header_rows,
       (SELECT COUNT(*) FROM dbo.bs_asm_bom WHERE ISNULL(工序, N'') = N'') AS blank_proc_rows,
       (SELECT ISNULL(config, N'<NULL>') FROM yj_panel WHERE panel_code = 'ASM_BOM') AS panel_config;
GO

-- ══════════ 6. 自检(不满足 → RAISERROR 16) ══════════
PRINT N'== 6. 自检 ==';
DECLARE @bad nvarchar(max) = N'';
DECLARE @cnt int;

-- 6.1 产品编码 = 文本、可编辑、必填、无任何参照配置
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'ASM_BOM' AND label = N'产品编码'
                  AND data_type = N'文本' AND editable = 1 AND required = 1
                  AND ref_panel IS NULL AND ref_field IS NULL AND display_field IS NULL)
    SET @bad = @bad + N'产品编码 未变成「文本/可编辑/必填/无参照」;';

-- 6.2 工序:不得出现在任何 header place;必须保留 query 查询条件
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序' AND place LIKE N'%header%')
    SET @bad = @bad + N'工序 仍在表头(place 含 header);';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序' AND place = N'query')
    SET @bad = @bad + N'工序 的查询条件(query place)丢了;';

-- 6.3 config.headDefaults:状态=启用 与 工序=组装 同时存在
DECLARE @cfg2 nvarchar(max);
SELECT @cfg2 = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
IF @cfg2 IS NULL
    SET @bad = @bad + N'config 为空(应含 headDefaults 状态=启用 + 工序=组装);';
ELSE IF @cfg2 NOT LIKE N'%headDefaults%' OR @cfg2 NOT LIKE N'%状态%' OR @cfg2 NOT LIKE N'%启用%'
    SET @bad = @bad + N'config.headDefaults 缺少 状态=启用;';
ELSE IF @cfg2 NOT LIKE N'%工序%' OR @cfg2 NOT LIKE N'%组装%'
    SET @bad = @bad + N'config.headDefaults 缺少 工序=组装;';

-- 6.4 面板字段仍 19(本脚本不增删字段;只做下限判断,容忍后人再加字段)
SELECT @cnt = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM';
IF @cnt < 19 SET @bad = @bad + N'面板字段总数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=19,不增删字段);';

-- 6.5 物理表结构未动(47 列 + 备注 列仍在)
SELECT @cnt = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
IF @cnt < 47 SET @bad = @bad + N'bs_asm_bom 列数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=47,本脚本不改表结构);';
IF COL_LENGTH('dbo.bs_asm_bom', N'备注') IS NULL
    SET @bad = @bad + N'bs_asm_bom.备注 列不存在;';

-- 6.6 不再有空工序行(下游按 工序=N''组装'' 取数,空值会取不到)
SELECT @cnt = COUNT(*) FROM dbo.bs_asm_bom WHERE ISNULL(工序, N'') = N'';
IF @cnt <> 0 SET @bad = @bad + N'仍有空工序行=' + CAST(@cnt AS nvarchar(10)) + N' 行;';

-- 6.7 汇总判定
IF @bad <> N''
BEGIN
    PRINT N'!! 自检失败: ' + @bad;
    RAISERROR(N'ASM_BOM product-manual migration self-check FAILED', 16, 1);
END
ELSE
    PRINT N'== 自检全部 PASS:产品编码=文本/可编辑/必填/无参照;工序已移出表头(保留查询);'
        + N'headDefaults 状态=启用+工序=组装;字段>=19;表>=47列;空工序行=0 ==';
GO
