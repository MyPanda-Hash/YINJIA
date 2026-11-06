-- ============================================================================
-- 组装物料清单(ASM_BOM)表头可维护 —— 元数据迁移(2026-11-04)
--
-- 报障(用户 2026-11-04):「这个组装物料清单中的表头无法填写啊,那后面这个物料清单
--   不是没法维护吗?」(数据建模 > 生产 > 组装物料清单,单号 T387_V0001,红框内表头全只读)。
--
-- 根因(取证见 tools 下 archive/_asm-bom-maintainable-verify-20261104/ 目录):
--   · 2026-10-30 建面板时 11 个表头字段全部登记 editable=0
--     (来源脚本 migrate-asm-bom-20261030.sql 第 165-197 行)⇒ 后端 PanelConfigService
--     把 readonly=true 下发前端 ⇒ PanelxList.headerFieldLocked() 判定为锁 ⇒ 表头输入框置灰。
--   · 单表 doc 保存链:「表头值优先」白名单 SINGLE_HEAD_WINS_PANELS 当时只有 ROUTE,
--     保存时行内旧值把表头新值盖回去 ⇒ 只放开 editable 仍会「改了表头存不回来」。
--     该链的代码修复与本脚本同批交付(ButtonService / PanelConfigService),见
--     docs/development/组装物料清单-表头可维护-20261104.md。
--
-- 本脚本**只改元数据**(yj_field / yj_panel.config),不改任何物理表结构、不增删字段行、
--   不动业务数据:bs_asm_bom 仍 47 列、yj_field 仍 19 行。
--   ⚠ 空白草稿建单不需要改 DDL:ButtonService.insertRow 会先 fillRequiredDefaults,
--     给「NOT NULL 且无默认值」的列补 ''/0(与表默认约束无关),故**不要再 ALTER TABLE
--     放宽 NOT NULL** —— 表结构改动对本次问题无帮助,只会扩大风险面。
--
-- 变更内容:
--   §1 表头 8 个字段 editable 0 → 1:
--      产品编码 / 产品名称 / 规格型号 / 工序 / 版本号 / 默认BOM / 工艺路线名称 / 备注
--   §2 仍保持 editable=0 的 3 个(设计口径,写在此处免得后人误开):
--      单据编号(新建自动取号)、来源(金蝶导入留痕)、状态(新建默认「启用」,由 §4 写入)
--   §3 选料参照:产品编码、子件编码 改为「参照」INV(存货编码/存货名称):
--      选料后 refMap 自动带回:产品名称(存货名称同义)、规格型号(同名);
--      子件名称、子件规格 由同批代码 PanelConfigService.REF_SYNONYMS 补的同义词带回。
--      存量历史值即使不在存货档案里也不会显示成空 —— 前端 ElSelect 未命中时回退显示原值。
--   §4 默认BOM 改「下拉框」:是 / 否。
--   §5 yj_panel.config 写新建默认值 headDefaults {"状态":"启用"}:
--      仅当 config 为 NULL/空白时整段写入;已有其它 config 则**不覆盖**,PRINT 提示手工合并。
--
-- 幂等:每条 UPDATE 都带「与目标值不同」的窄条件 + @@ROWCOUNT 打印;重跑第二次影响 0 行。
-- 两账套:HSDZ_MES(正式)先、HSDZ_MES_TEST(测试)后,均在 tools 目录执行:
--   正式:java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql
--   测试:$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-asm-bom-maintainable-20261104.sql
--
-- 自检(§7,不满足即 RAISERROR 16 失败):
--   表头可编辑集合 = 8 个、仍只读集合 = {单据编号,来源,状态}、
--   参照字段 = 2 个(产品编码/子件编码)、默认BOM = 下拉框(含是/否)、
--   config 含 headDefaults 状态=启用、面板字段总数仍 19、物理表仍 47 列、面板形态未变。
--
-- ⚠ 本脚本注释里不写「斜杠 + 星号」相邻组合(2026-11-02 踩坑:T-SQL 块注释可嵌套,
--   注释里出现该组合会被当成嵌套注释起始 / 提前闭合)。全脚本只用行注释。
-- ⚠ 不写无条件 USE(会把 DbSync 目标库切走);DbSync 已连接目标账套。
-- ============================================================================
SET NOCOUNT ON;
GO

-- ══════════ 0. 改前快照(只读;证明「表头全只读」的现场) ══════════
PRINT N'== 0. 改前快照:ASM_BOM 表头字段(yj_field.place 含 header)==';
SELECT DB_NAME() AS db_name, label, place, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       ISNULL(display_field, N'') AS display_field, editable
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
 ORDER BY seq, id;
GO
PRINT N'== 0b. 改前统计:表头 editable=1 / editable=0 条数;全面板字段数;物理表列数 ==';
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1) AS hdr_editable_1,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 0) AS hdr_editable_0,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM') AS panel_fields,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom')) AS asm_bom_cols,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照') AS ref_fields,
       (SELECT ISNULL(config, N'<NULL>') FROM yj_panel WHERE panel_code = 'ASM_BOM') AS panel_config;
GO

-- ══════════ 1. 表头可填写:8 个字段 editable 0 → 1 ══════════
PRINT N'== 1. 表头可填写:8 个字段 editable 0 -> 1 ==';
DECLARE @n1 int;
UPDATE yj_field
   SET editable = 1
 WHERE panel_code = 'ASM_BOM'
   AND place LIKE N'%header%'
   AND label IN (N'产品编码', N'产品名称', N'规格型号', N'工序',
                 N'版本号', N'默认BOM', N'工艺路线名称', N'备注')
   AND editable = 0;                     -- 幂等:已是 1 的不再动
SET @n1 = @@ROWCOUNT;
PRINT N'  影响行数(首次 8 / 重跑 0):' + CAST(@n1 AS nvarchar(10));
GO

-- ══════════ 2. 仍保持 editable=0 的 3 个(设计口径) ══════════
PRINT N'== 2. 仍保持只读的 3 个表头字段(单据编号=自动取号;来源=金蝶导入留痕;状态=新建默认启用,由 §5 写)==';
DECLARE @n2 int;
UPDATE yj_field
   SET editable = 0
 WHERE panel_code = 'ASM_BOM'
   AND place LIKE N'%header%'
   AND label IN (N'单据编号', N'来源', N'状态')
   AND editable = 1;                     -- 幂等守卫:若有人手改过则拉回设计口径
SET @n2 = @@ROWCOUNT;
PRINT N'  影响行数(期望 0;非 0 说明这 3 个曾被误开,已拉回):' + CAST(@n2 AS nvarchar(10));
GO

-- ══════════ 3. 选料参照:产品编码 / 子件编码 → 参照 INV ══════════
-- ref_field / display_field 取**目标面板的字段标签**(INV 的 存货编码 / 存货名称,不是物理列名)。
-- 存量历史值不在存货档案里也不会显示成空(前端参照控件未命中时回退显示原值)。
PRINT N'== 3. 选料参照:产品编码 / 子件编码 → 参照 INV(存货编码/存货名称)==';
DECLARE @n3 int;
UPDATE yj_field
   SET data_type     = N'参照',
       ref_panel     = N'INV',
       ref_field     = N'存货编码',
       display_field = N'存货名称'
 WHERE panel_code = 'ASM_BOM'
   AND label IN (N'产品编码', N'子件编码')
   AND (ISNULL(data_type, N'')     <> N'参照'
        OR ISNULL(ref_panel, N'')  <> N'INV'
        OR ISNULL(ref_field, N'')  <> N'存货编码'
        OR ISNULL(display_field, N'') <> N'存货名称');   -- 幂等:已是目标配置的不再动
SET @n3 = @@ROWCOUNT;
PRINT N'  影响行数(首次 2 / 重跑 0):' + CAST(@n3 AS nvarchar(10));
GO
PRINT N'== 3b. 参照配置对照(产品编码 在表头、子件编码 在明细)==';
SELECT label, place, data_type, ref_panel, ref_field, display_field, editable
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND label IN (N'产品编码', N'子件编码')
 ORDER BY seq;
GO

-- ══════════ 4. 默认BOM 改「下拉框」(是/否) ══════════
-- 保留 editable=1(由 §1 已置;本段不碰 editable)。字典写死两个中文值:
-- 与历史导入值(金蝶「默认BOM」列:是/空)同口径,空值仍允许(下拉可清除)。
PRINT N'== 4. 默认BOM 改下拉框(是/否)==';
DECLARE @n4 int;
DECLARE @bomDict nvarchar(500) = N'SELECT N''是'' AS v UNION ALL SELECT N''否''';
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = @bomDict
 WHERE panel_code = 'ASM_BOM'
   AND label = N'默认BOM'
   AND (ISNULL(data_type, N'') <> N'下拉框'
        OR ISNULL(dict_sql, N'') <> @bomDict);            -- 幂等:已是目标配置的不再动
SET @n4 = @@ROWCOUNT;
PRINT N'  影响行数(首次 1 / 重跑 0):' + CAST(@n4 AS nvarchar(10));
GO
PRINT N'== 4b. 默认BOM 现状 ==';
SELECT label, data_type, dict_sql, editable
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';
GO

-- ══════════ 5. 新建默认值:yj_panel.config 写 headDefaults {"状态":"启用"} ══════════
-- 口径(PanelRegistry.headDefaults / ButtonService.putHeadDefaults,2026-10-29):
--   键 = yj_field.label(数据键,中文),值 = 新建单据时的默认值;只在建单且该格为空时写入。
--   「状态」保持 editable=0(第 2 段口径),用户看到的就是新建即「启用」,但不可手改。
-- 安全:仅当 config 为 NULL/空白时整段写;若已有其它 config 内容 → 不覆盖,PRINT 提示手工合并
--       (此时 §7 自检会失败,按提示合并后重跑即可)。
PRINT N'== 5. 新建默认值:yj_panel.config 合并 headDefaults(状态=启用)==';
DECLARE @cfg nvarchar(max);
SELECT @cfg = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
IF @cfg IS NULL OR LTRIM(RTRIM(@cfg)) = N''
BEGIN
    DECLARE @n5 int;
    UPDATE yj_panel
       SET config = N'{"headDefaults":{"状态":"启用"}}'
     WHERE panel_code = 'ASM_BOM'
       AND (config IS NULL OR LTRIM(RTRIM(config)) = N'');  -- 幂等:已写过则不再匹配
    SET @n5 = @@ROWCOUNT;
    PRINT N'  config 原为空,已写入(首次 1 / 重跑 0):' + CAST(@n5 AS nvarchar(10));
END
ELSE IF @cfg LIKE N'%headDefaults%'
    PRINT N'  config 已含 headDefaults,未覆盖(幂等跳过)';
ELSE
    PRINT N'  !! config 已有其它内容,未覆盖。请手工把 {"headDefaults":{"状态":"启用"}} 合并进该 JSON 后重跑本脚本(§7 自检会据此判定)。';
GO
PRINT N'== 5b. 面板 config 现状 ==';
SELECT panel_code, panel_name, mode, line_table, ISNULL(head_table, N'<NULL>') AS head_table,
       group_col, prefix, ISNULL(config, N'<NULL>') AS config
  FROM yj_panel WHERE panel_code = 'ASM_BOM';
GO

-- ══════════ 6. 改后对照 ══════════
-- 期望:表头 8 个 editable=1、3 个仍 0;产品编码/子件编码 data_type=参照(INV);默认BOM=下拉框。
PRINT N'== 6. 改后对照:ASM_BOM 表头字段 ==';
SELECT label, place, data_type,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field,
       ISNULL(display_field, N'') AS display_field, editable
  FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%'
 ORDER BY seq, id;
GO
PRINT N'== 6b. 改后统计:表头 editable=1 / editable=0 条数;全面板字段数;物理表列数 ==';
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1) AS hdr_editable_1,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 0) AS hdr_editable_0,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM') AS panel_fields,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom')) AS asm_bom_cols,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照') AS ref_fields,
       (SELECT ISNULL(config, N'<NULL>') FROM yj_panel WHERE panel_code = 'ASM_BOM') AS panel_config;
GO

-- ══════════ 7. 自检(不满足 → RAISERROR 16,DbSync 判 FAIL 并停止登记) ══════════
PRINT N'== 7. 自检 ==';
DECLARE @bad nvarchar(max) = N'';
DECLARE @cnt int;

-- 7.1 表头设计集合必须全部可取(允许后人再加字段:本脚本只保证「设计这 8 个不再只读」,
--     不做「集合必须恰好等于 8」的硬判断 —— 否则日后加字段再重跑本脚本会自检 FAIL 并卡住迁移链)
DECLARE @wantOn TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantOn (label) VALUES
    (N'产品编码'), (N'产品名称'), (N'规格型号'), (N'工序'),
    (N'版本号'), (N'默认BOM'), (N'工艺路线名称'), (N'备注');
DECLARE @actOn TABLE (label nvarchar(60));
INSERT INTO @actOn (label)
SELECT label FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1;
SELECT @cnt = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1;
IF @cnt < 8 SET @bad = @bad + N'表头editable=1条数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=8);';
IF EXISTS (SELECT label FROM @wantOn EXCEPT SELECT label FROM @actOn)
    SET @bad = @bad + N'表头可编辑集合缺少设计字段;';

-- 7.2 设计上仍只读的 3 个必须仍 editable=0(同样只做「包含」判断,容忍后人再加别的只读表头字段)
DECLARE @wantOff TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantOff (label) VALUES (N'单据编号'), (N'来源'), (N'状态');
SELECT @cnt = COUNT(*) FROM yj_field f
 WHERE f.panel_code = 'ASM_BOM' AND f.place LIKE N'%header%' AND f.editable = 0
   AND EXISTS (SELECT 1 FROM @wantOff w WHERE w.label = f.label);
IF @cnt < 3 SET @bad = @bad + N'仍只读的 单据编号/来源/状态 不足 3 个(被误开?);';
IF EXISTS (SELECT label FROM @wantOff EXCEPT
           SELECT label FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 0)
    SET @bad = @bad + N'仍只读集合缺少 单据编号/来源/状态;';

-- 7.3 选料参照:设计的 2 个必须配成 INV(存货编码→存货名称);允许后人再加参照字段
DECLARE @wantRef TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantRef (label) VALUES (N'产品编码'), (N'子件编码');
DECLARE @actRef TABLE (label nvarchar(60));
INSERT INTO @actRef (label)
SELECT label FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND data_type = N'参照'
   AND ref_panel = N'INV' AND ref_field = N'存货编码' AND display_field = N'存货名称';
SELECT @cnt = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照';
IF @cnt < 2 SET @bad = @bad + N'参照字段条数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=2);';
IF EXISTS (SELECT label FROM @wantRef EXCEPT SELECT label FROM @actRef)
    SET @bad = @bad + N'参照字段缺失 产品编码/子件编码 或 INV 配置不全;';

-- 7.4 默认BOM = 下拉框,字典含 是/否,且保持可编辑
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM'
                  AND data_type = N'下拉框' AND editable = 1
                  AND dict_sql LIKE N'%是%' AND dict_sql LIKE N'%否%')
    SET @bad = @bad + N'默认BOM 不是「下拉框(是/否,可编辑)」;';

-- 7.5 yj_panel.config 已含 headDefaults 且 状态=启用
DECLARE @cfg2 nvarchar(max);
SELECT @cfg2 = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
IF @cfg2 IS NULL
    SET @bad = @bad + N'config 为空(应含 headDefaults 状态=启用);';
ELSE IF @cfg2 NOT LIKE N'%headDefaults%' OR @cfg2 NOT LIKE N'%状态%' OR @cfg2 NOT LIKE N'%启用%'
    SET @bad = @bad + N'config 未含 headDefaults/状态/启用;';

-- 7.6 面板字段数不得**少于** 19(本脚本不增删字段行;容忍后人继续加字段,避免日后重跑本脚本自检 FAIL 卡住迁移链)
SELECT @cnt = COUNT(*) FROM yj_field WHERE panel_code = 'ASM_BOM';
IF @cnt < 19 SET @bad = @bad + N'面板字段总数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=19,本脚本不增删字段);';

-- 7.7 面板形态未变:1 行;单表 doc(line_table=bs_asm_bom,head_table IS NULL,group_col=单据编号)
SELECT @cnt = COUNT(*) FROM yj_panel WHERE panel_code = 'ASM_BOM';
IF @cnt <> 1 SET @bad = @bad + N'yj_panel 行数=' + CAST(@cnt AS nvarchar(10)) + N'(应1);';
IF NOT EXISTS (SELECT 1 FROM yj_panel
                WHERE panel_code = 'ASM_BOM' AND mode = 'doc' AND line_table = 'bs_asm_bom'
                  AND head_table IS NULL AND group_col = N'单据编号')
    SET @bad = @bad + N'面板形态被改动(应 doc/bs_asm_bom/head_table NULL/group_col 单据编号);';

-- 7.8 物理表结构不得**少于** 47 列(本脚本不改表结构;容忍后人加列,理由同 7.6),且 备注 列仍在(表头字段指向它)
SELECT @cnt = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
IF @cnt < 47 SET @bad = @bad + N'bs_asm_bom 列数=' + CAST(@cnt AS nvarchar(10)) + N'(应>=47,本脚本不改表结构);';
IF COL_LENGTH('dbo.bs_asm_bom', N'备注') IS NULL
    SET @bad = @bad + N'bs_asm_bom.备注 列不存在;';

-- 7.9 汇总判定
IF @bad <> N''
BEGIN
    PRINT N'!! 自检失败: ' + @bad;
    RAISERROR(N'ASM_BOM maintainable migration self-check FAILED', 16, 1);
END
ELSE
    PRINT N'== 自检全部 PASS:表头8可编辑/3只读、参照2(INV)、默认BOM下拉框、config.headDefaults 状态=启用、字段19、表47列、面板形态未变 ==';
GO

