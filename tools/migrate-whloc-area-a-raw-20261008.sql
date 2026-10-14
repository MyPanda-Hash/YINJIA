-- migrate-whloc-area-a-raw-20261008.sql — 原材料区(A仓) 仓位落地 + 仓位档案层次列
--
-- 【需求】用户 2026-10-08:「根据图中数据(仓库库位信息表 Sheet2)为当前仓库增加仓位,
--   仓位先增加原材料区(A仓),实现对这个仓位的设定」。
--   口径已确认:① 仓库表由用户有意清理过,按新仓库来;② 原材料区(A仓) 新建仓库档案「原材料区A仓」;
--   ③ 货架区 AH 原文截断(`AH5-1/2/3-1...`),层数按 **3 层** 做。
--
-- 【来源】Sheet2 老厂区「原材料区(A仓)」三列:
--   炭粉区仓位  A1-09-1/2/3 … A1-19-1/2/3  (+ 末行笔误 `41-20-1/2/3` ⇒ 按 A1-20-1/2/3 收录)
--   胶粉区仓位  A1-21-1/2/3 … A1-24-1/2/3
--   货架区      AH5-1/2/3-1... … AH15-1/2/3-1...  (+ 末行笔误 `4H16-1/2/3-1...` ⇒ 按 AH16 收录)
--   ⇒ 炭粉区 12 排 × 3 位 = 36;胶粉区 4 排 × 3 位 = 12;货架区 12 排 × 3 位 × 3 层 = 108;**合计 156 个仓位**。
--   编码严格照文档原文:A1-<排2位>-<位> / AH<排>-<位>-<层>(不另发明编码)。
--
-- 【内容】
--   1. bs_wh 新增仓库档案「原材料区A仓」(编码 CK-A) —— 用户已确认新建,不恢复被删的 CK01
--   2. bs_wh_loc 加 4 个层次列(存储分区/排号/位号/层号) + 中文注明
--      (2026-10-08 事故修复:另有一个 `厂区` 列**已整段摘除** —— 用户后来定「厂区应该在仓库表而不是仓位表」,
--       该列由 migrate-whloc-zone-logic DROP、改由 bs_wh.厂区 承载;原写法会在重跑时把它"自愈"补回来,
--       连带 yj_field 又插一行 ⇒ 仓位表多出「厂区」列 + 元数据漂移。同理 `库区` 直接用最终名 `存储分区`
--       创建,不再依赖链上后续改名。两处均不改变首次应用的最终态。)
--   3. yj_field 注册这 4 列 + 九语言译名(厂区 的译名保留 —— bs_wh.厂区 复用同一 label)
--   4. 幂等生成 156 个仓位
--   5. 验证
--
-- 【幂等】仓库按 仓库编码 判存在;加列按 COL_LENGTH;字段按 col_name;译名按 (scope,ref_key,locale);
--   仓位按 仓位编码 NOT EXISTS。可重复执行(复跑 = 全 no-op)。
--   ⚠ 本脚本的守卫必须**跨过链上后续的改名/删列**(2026-10-08 实测重跑造出重复列/漂移字段,
--     原委见 §2/§3/§5.4 注释与 migrate-whloc-fix-dup-zone-field-20261008.sql 头部)。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 仓库档案「原材料区A仓」(id 为 IDENTITY,不显式给;状态有默认值 N'启用') ══════════
IF NOT EXISTS (SELECT 1 FROM dbo.bs_wh WHERE 仓库编码 = N'CK-A')
BEGIN
  INSERT INTO dbo.bs_wh (仓库编码, 仓库名称, 停用, 允许零库存出库, 备注, asp_user1, asp_time1, asp_cancel, 仓库类型)
  VALUES (N'CK-A', N'原材料区A仓', 0, 0,
          N'仓库总体规划(A仓)老厂区原材料区:炭粉区/胶粉区/货架区;2026-10-08 为仓位体系新建,非金蝶同步',
          N'migration', SYSDATETIME(), N'N', N'原料仓');
  PRINT N'  ✓ bs_wh 新增仓库 CK-A 原材料区A仓';
END
ELSE PRINT N'  · bs_wh CK-A 已存在,跳过';
GO

-- ══════════ 2. 仓位档案加层次列(库区/排号/位号/层号) ══════════
-- 🔴 2026-10-08 事故修复:`厂区` 已从本节的**加列**与 §3 的**字段登记**、§6 的**数据 INSERT** 中彻底摘掉。
--   原因:用户后来定「厂区应该在仓库表而不是仓位表」⇒ migrate-whloc-zone-logic 会
--   `ALTER TABLE bs_wh_loc DROP COLUMN [厂区]` + 删掉对应 yj_field 行。
--   而本节原写法 `IF COL_LENGTH(...'厂区') IS NULL ALTER TABLE ... ADD [厂区]` 会**"自愈"式地把该列补回来**,
--   于是 §3 的字段登记守卫(只看 col_name 是否存在)随之放行、又插一行挂在仓位表上的「厂区」字段
--   ⇒ ① 该列与 bs_wh.厂区 重复承载同一语义;② 元数据漂移(体检 05 项);③ 界面上仓位表多出「厂区」列。
--   实测:2026-10-08 一次重跑(见 migrate-whloc-fix-dup-zone-field 头部时间线)就把它造了回来。
--   ⚠ 摘掉后**首次应用的最终态一字不变**:该列随后必被 zone-logic DROP,且中间无人读它
--     (同样的处理早已用于 migrate-whloc-rest-20261008.sql,见其 §2/§3 注释)。
IF COL_LENGTH('dbo.bs_wh_loc', N'存储分区') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [存储分区] nvarchar(30)  NULL;
IF COL_LENGTH('dbo.bs_wh_loc', N'排号') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [排号] nvarchar(10)  NULL;
IF COL_LENGTH('dbo.bs_wh_loc', N'位号') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [位号] nvarchar(10)  NULL;
IF COL_LENGTH('dbo.bs_wh_loc', N'层号') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [层号] nvarchar(10)  NULL;
PRINT N'  ✓ bs_wh_loc 层次列就绪';

-- 中文注明(AGENTS.md:改结构须补注;厂区 归 bs_wh 承载,此处不再有该列)
-- ⚠ 本列**直接用最终名 `存储分区`** 创建(2026-10-08 事故修复):原来叫 `库区`、由链上后一条
--   migrate-whloc-clean-coord §2 改名。改名本身有守卫(库区 在 且 存储分区 不在 才改),所以
--   "一开始就叫存储分区"时那条改名自然 no-op,**首次应用的最终态一字不变**;
--   但重跑路径从此不再把废弃的 `库区` 列补回来(原来 §2 的 `IF COL_LENGTH('库区') IS NULL ADD`
--   会把已被改名的列重新建出来 —— 实测该空列就是这么回来的)。
IF COL_LENGTH('dbo.bs_wh_loc', N'存储分区') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'存储分区')
  EXEC sp_addextendedproperty N'MS_Description', N'存储分区(仓内用途分区:炭粉区/胶粉区/货架区/纸箱区/端盖区…;来自《仓库总体规划》列头;2026-10-08 新增,原名「库区」)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'存储分区';
IF COL_LENGTH('dbo.bs_wh_loc', N'排号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'排号')
  EXEC sp_addextendedproperty N'MS_Description', N'排号(货架排,存编码里的排段原文:09~24 或 AH5~AH16;2026-10-08 新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'排号';
IF COL_LENGTH('dbo.bs_wh_loc', N'位号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'位号')
  EXEC sp_addextendedproperty N'MS_Description', N'位号(一排货架的第几格/第几侧,1/2/3;2026-10-08 新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'位号';
IF COL_LENGTH('dbo.bs_wh_loc', N'层号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'层号')
  EXEC sp_addextendedproperty N'MS_Description', N'层号(货架层,目前仅货架区 AH 系列用:1/2/3;炭粉/胶粉区为空;2026-10-08 新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'层号';
GO

-- ══════════ 3. yj_field 注册层次列(库区/排号/位号/层号) ══════════
-- 🔴 守卫必须**跨过本链后续的改名**(2026-10-08 事故修复):
--   「库区」被 migrate-whloc-clean-coord §2 **改名成「存储分区」**。原守卫只看 col_name='库区' ——
--   重跑时找不到 ⇒ **又插一行「库区」**,紧接着 clean-coord 又把它改名成「存储分区」
--   ⇒ 同面板两行「存储分区」,**界面上出现两列同名**(用户 2026-10-08 报障)。
--   实锤时间线(yj_schema_log):正式库 zonepick 15:23:48 → area-a-raw 16:04:52 → clean-coord 16:04:52.66
--   ⇒ 多出一行 id=16157(seq 34,类型「文本」);测试库重跑两次 ⇒ 多两行。
--   ⇒ 守卫改为 `col_name IN (N'库区', N'存储分区')`(改名前后的两个名字都算“已登记”)。
--   ⚠ 「厂区」的登记行**已整段摘除**(不再是"加守卫"而是"不存在"):该列被 zone-logic 从 bs_wh_loc
--     删列并删登记,厂区归 bs_wh.厂区 承载;留着登记(即使加了 COL_LENGTH 守卫)只要上游"自愈"补列
--     就会重新插回来 ⇒ 干脆不注册,与 §2 摘掉加列、§6 摘掉 INSERT 列三处一致。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'存储分区')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'存储分区', N'存储分区', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 34, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'排号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'排号', N'排号', N'文本', NULL, NULL, NULL, NULL, N'detail', 36, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'位号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'位号', N'位号', N'文本', NULL, NULL, NULL, NULL, N'detail', 38, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'层号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'层号', N'层号', N'文本', NULL, NULL, NULL, NULL, N'detail', 39, 70, 1, 0, 0, 1);
PRINT N'  ✓ yj_field WHLOC 层次列注册(存储分区/排号/位号/层号;厂区 归 bs_wh 不再注册)';
GO

-- ══════════ 4. 九语言译名(uq_translation 冲突感知:目标已存在则不插) ══════════
DECLARE @tr TABLE (ref_key nvarchar(100), locale varchar(10), text nvarchar(200));
INSERT INTO @tr (ref_key, locale, text) VALUES
 (N'厂区','en',N'Plant'),        (N'厂区','ja',N'工場'),          (N'厂区','ko',N'공장'),
 (N'厂区','de',N'Werk'),         (N'厂区','es',N'Planta'),        (N'厂区','fr',N'Usine'),
 (N'厂区','ru',N'Завод'),        (N'厂区','th',N'โรงงาน'),        (N'厂区','vi',N'Nhà máy'),
 (N'存储分区','en',N'Zone'),      (N'存储分区','ja',N'エリア'),     (N'存储分区','ko',N'구역'),
 (N'存储分区','de',N'Zone'),      (N'存储分区','es',N'Zona'),      (N'存储分区','fr',N'Zone'),
 (N'存储分区','ru',N'Зона'),      (N'存储分区','th',N'พื้นที่จัดเก็บ'), (N'存储分区','vi',N'Khu vực'),
 (N'排号','en',N'Row No.'),      (N'排号','ja',N'列番号'),        (N'排号','ko',N'열 번호'),
 (N'排号','de',N'Reihen-Nr.'),   (N'排号','es',N'N.º de fila'),   (N'排号','fr',N'N° de rangée'),
 (N'排号','ru',N'Номер ряда'),   (N'排号','th',N'หมายเลขแถว'),    (N'排号','vi',N'Số hàng'),
 (N'位号','en',N'Position No.'), (N'位号','ja',N'位置番号'),      (N'位号','ko',N'위치 번호'),
 (N'位号','de',N'Positions-Nr.'),(N'位号','es',N'N.º de posición'),(N'位号','fr',N'N° de position'),
 (N'位号','ru',N'Номер позиции'),(N'位号','th',N'หมายเลขตำแหน่ง'), (N'位号','vi',N'Số vị trí'),
 (N'层号','en',N'Level No.'),    (N'层号','ja',N'階番号'),        (N'层号','ko',N'층 번호'),
 (N'层号','de',N'Ebenen-Nr.'),   (N'层号','es',N'N.º de nivel'),  (N'层号','fr',N'N° de niveau'),
 (N'层号','ru',N'Номер уровня'), (N'层号','th',N'หมายเลขชั้น'),    (N'层号','vi',N'Số tầng');

DECLARE @trn int;
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.ref_key, t.locale, t.text, 'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.ref_key AND x.locale=t.locale);
SET @trn = @@ROWCOUNT;   -- ⚠ 必须先落变量:@@ROWCOUNT 会被后续语句(含 PRINT)重置
PRINT N'  ✓ 译名补充 ' + CAST(@trn AS nvarchar(10)) + N' 条(已存在的不重复插)';
GO

-- ══════════ 5. 生成 156 个仓位(编码严格照《仓库总体规划》原文) ══════════
DECLARE @gen TABLE (库区 nvarchar(30), 排号 nvarchar(10), 位号 nvarchar(10), 层号 nvarchar(10),
                    仓位编码 nvarchar(100), 仓位地址 nvarchar(200));

-- 5.1 炭粉区:排 09~20,位 1~3(文档原文 A1-09-1/2/3 … A1-19-1/2/3,末行笔误 41-20 ⇒ A1-20)
DECLARE @p int = 9, @b int, @ps nvarchar(2);
WHILE @p <= 20
BEGIN
  SET @ps = RIGHT(N'0' + CAST(@p AS nvarchar(2)), 2);
  SET @b = 1;
  WHILE @b <= 3
  BEGIN
    INSERT INTO @gen VALUES (N'炭粉区', @ps, CAST(@b AS nvarchar(2)), NULL,
      N'A1-' + @ps + N'-' + CAST(@b AS nvarchar(2)),
      N'炭粉区' + @ps + N'排' + CAST(@b AS nvarchar(2)) + N'位');
    SET @b += 1;
  END
  SET @p += 1;
END

-- 5.2 胶粉区:排 21~24,位 1~3
SET @p = 21;
WHILE @p <= 24
BEGIN
  SET @ps = RIGHT(N'0' + CAST(@p AS nvarchar(2)), 2);
  SET @b = 1;
  WHILE @b <= 3
  BEGIN
    INSERT INTO @gen VALUES (N'胶粉区', @ps, CAST(@b AS nvarchar(2)), NULL,
      N'A1-' + @ps + N'-' + CAST(@b AS nvarchar(2)),
      N'胶粉区' + @ps + N'排' + CAST(@b AS nvarchar(2)) + N'位');
    SET @b += 1;
  END
  SET @p += 1;
END

-- 5.3 货架区:排 AH5~AH16,位 1~3,层 1~3(原文 AH5-1/2/3-1... 截断,层数按用户口径 3 层)
DECLARE @r int = 5, @lay int, @rs nvarchar(4);
WHILE @r <= 16
BEGIN
  SET @rs = N'AH' + CAST(@r AS nvarchar(2));
  SET @b = 1;
  WHILE @b <= 3
  BEGIN
    SET @lay = 1;
    WHILE @lay <= 3
    BEGIN
      INSERT INTO @gen VALUES (N'货架区', @rs, CAST(@b AS nvarchar(2)), CAST(@lay AS nvarchar(2)),
        @rs + N'-' + CAST(@b AS nvarchar(2)) + N'-' + CAST(@lay AS nvarchar(2)),
        N'货架区' + @rs + N'排' + CAST(@b AS nvarchar(2)) + N'位' + CAST(@lay AS nvarchar(2)) + N'层');
      SET @lay += 1;
    END
    SET @b += 1;
  END
  SET @r += 1;
END

DECLARE @genn int;
SELECT @genn = COUNT(*) FROM @gen;   -- ⚠ PRINT 里不能直接写子查询(Only scalar expressions are allowed)
PRINT N'  · 待生成 ' + CAST(@genn AS nvarchar(10)) + N' 个仓位(期望 156)';

-- 5.4 幂等落库(已存在的 仓位编码 跳过)
-- ⚠ 目标列名用**最终名 `存储分区`**(原为 `库区`,链上 clean-coord 会改名,道理同 §2);
--   列清单里**不再有 `厂区`** —— 该列已被 zone-logic 从本表摘除,留着会在重跑时
--   报编译期 `Invalid column name '厂区'`(与 migrate-whloc-rest 同款处理,最终态一字不变)。
DECLARE @ins int;
INSERT INTO dbo.bs_wh_loc (仓库, 仓库编码, 仓位编码, 仓位地址, 存储分区, 排号, 位号, 层号, 停用, asp_user1, asp_time1, asp_cancel)
SELECT N'原材料区A仓', N'CK-A', g.仓位编码, g.仓位地址, g.库区, g.排号, g.位号, g.层号, 0, N'migration', SYSDATETIME(), N'N'
FROM @gen g
WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_wh_loc l WHERE l.仓位编码 = g.仓位编码 AND ISNULL(l.asp_cancel,'N') <> 'Y');
SET @ins = @@ROWCOUNT;
PRINT N'  ✓ 新增仓位 ' + CAST(@ins AS nvarchar(10)) + N' 行';
GO

-- ══════════ 6. 验证 ══════════
SELECT N'仓库 CK-A(应 1)' AS 检查项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM dbo.bs_wh WHERE 仓库编码=N'CK-A'
UNION ALL SELECT N'层次列 4 列(应 4;厂区归 bs_wh)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns
  WHERE object_id=OBJECT_ID('dbo.bs_wh_loc') AND name IN (N'存储分区',N'排号',N'位号',N'层号')
UNION ALL SELECT N'层次列注明(应 4)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description'
    AND c.name IN (N'存储分区',N'排号',N'位号',N'层号')
UNION ALL SELECT N'WHLOC 字段数(应 10)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WHLOC'
UNION ALL SELECT N'层次列+厂区 译名(应 45)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation
  WHERE scope='field' AND ref_key IN (N'厂区',N'存储分区',N'排号',N'位号',N'层号')
UNION ALL SELECT N'CK-A 仓位数(应 156)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A'
UNION ALL SELECT N'  炭粉区(应 36)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND 存储分区=N'炭粉区'
UNION ALL SELECT N'  胶粉区(应 12)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND 存储分区=N'胶粉区'
UNION ALL SELECT N'  货架区(应 108)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND 存储分区=N'货架区'
UNION ALL SELECT N'仓位编码重复组(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM (SELECT 仓位编码 FROM dbo.bs_wh_loc GROUP BY 仓位编码 HAVING COUNT(*)>1) d
UNION ALL SELECT N'总行数(5 旧 + 156 新 = 161)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc;
GO
PRINT N'migrate-whloc-area-a-raw-20261008 完成';
GO
