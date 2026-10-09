-- migrate-whloc-clean-coord-20261008.sql — 仓位档案「坐标列 vs 用途分区」解耦 + 清理试录垃圾行
--
-- 【为什么改】2026-10-08 体检(tools/archive/_whloc-req/q-19/q-20)发现上一版把**两个维度压进了一列**:
--   · 物理区码(A1/A2/AH/B1..C2) 与 用途分区(炭粉区/胶粉区/货架区) 是**两个维度**,却共用「库区」一列;
--     实证:`A1` 这一个区码同时承载 炭粉区(排09~20) 与 胶粉区(排21~24) —— 用途是按排号区间切的标签,不是物理层级。
--   · 货架区 108 行的「排号」塞的是 `AH5`(区码+排号连写),炭粉/胶粉 48 行是纯数字 `09` —— 同列两种含义。
--   · 且 Excel 编码语法本身不统一:`A1-09-1`(3段=区-排-位) vs `AH5-1-1`(4段=区排连写-位-层)。
--
-- 【收敛后的模型】「一表、两维度分开、编码为唯一真源」:
--   · `仓位编码` = **文档原文,不重算不臆造**(扫码/参照的唯一键;因文档语法不统一,**不要求能由坐标列反推**)
--   · 物理坐标列:`区码`(A1/A2/AH/B1…)/`排号`(纯排段 09 或 5)/`位号`(1..5)/`层号`(1..3 或空) —— 供筛选聚合
--   · 用途列:`库区` **改名 `存储分区`**(与「区码」区分开;取值 = Excel 列头 炭粉区/胶粉区/货架区/纸箱区…)
--   · `仓位地址` = 人读位置串(派生显示,保留既有可读写法,不参与推导)
--
-- 【拆分规则(按首段"前导字母数"判族,可覆盖 Excel 全部形态)】
--   两个族的编码**都是 3 个连字符段**,差别在首段:
--     · 区域族(前导字母 1 个,如 A1/A2/B1~B4/C1/C2):`<区码>-<排>-<位>`(无层)
--         A1-09-1 ⇒ 区码=A1 排=09 位=1 层=空 ; A1-1-1(纸箱区) ⇒ A1 / 1 / 1 / 空 ; A2-2-1(端盖区) ⇒ A2 / 2 / 1 / 空
--     · 货架族(前导字母 ≥2 个,即 AH):`<区码><排>-<位>-<层>`(首段把区码与排号连写)
--         AH5-1-1 ⇒ 区码=AH 排=5 位=1 层=1 ; AH17-1-1(标签区) ⇒ AH / 17 / 1 / 1 ; AH1-2-1(网套区) ⇒ AH / 1 / 2 / 1
--   ⚠ 不能用"段数"判族:`A1-09-1` 与 `AH5-1-1` 都是 3 段(初版据此写错,把 AH10-1-1 解成 区码=AH10/排=1/层=空,已由本版修正)。
--
-- 【内容】
--   1. bs_wh_loc 加 `区码` + 中文注明
--   2. `库区` → `存储分区`(sp_rename + yj_field col_name/label + yj_translation ref_key,冲突感知)
--   3. 按上述规则**从 `仓位编码` 原文重算** 区码/排号/位号/层号(CK-A 全部行)
--   4. **软删试录垃圾行**(2018-09-28 admin 试录的 da5x/d2/s/e/d 与空编码行;asp_cancel='Y',可回滚)
--   5. yj_field 注册 `区码` + 九语言译名
--   6. 验证
--
-- 【幂等】加列按 COL_LENGTH;改名按旧名存在且新名不存在;重算为确定性赋值(重跑结果相同);
--   软删按 asp_cancel 已 'Y' 则不再改。可重复执行。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 加 `区码` 列 ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'区码') IS NULL ALTER TABLE dbo.bs_wh_loc ADD [区码] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bs_wh_loc', N'区码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'区码')
  EXEC sp_addextendedproperty N'MS_Description',
    N'区码(仓位编码第一段的物理区:A1/A2/AH/B1~B4/C1/C2;与「存储分区」是两个维度——同一个 A1 区可同时承载炭粉区与胶粉区;2026-10-08 新增)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'区码';
PRINT N'  ✓ 区码 列就绪';
GO

-- ══════════ 2. `库区` → `存储分区`(名字必须与「区码」拉开:一个是用途,一个是坐标) ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'库区') IS NOT NULL AND COL_LENGTH('dbo.bs_wh_loc', N'存储分区') IS NULL
BEGIN
  EXEC sp_rename N'dbo.bs_wh_loc.库区', N'存储分区', N'COLUMN';
  PRINT N'  ✓ bs_wh_loc.库区 → 存储分区';
END
IF COL_LENGTH('dbo.bs_wh_loc', N'存储分区') IS NOT NULL AND EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id
  WHERE ep.major_id=OBJECT_ID('dbo.bs_wh_loc') AND ep.class=1 AND ep.name='MS_Description' AND c.name=N'存储分区')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'存储分区(用途标签 = 《仓库总体规划》列头:炭粉区/胶粉区/货架区/纸箱区/端盖区/PP棉区/无纺布区/网套区/标签区;按(区码,排号区间)切,不是物理层级;2026-10-08 由「库区」正名)',
    N'SCHEMA',N'dbo',N'TABLE',N'bs_wh_loc',N'COLUMN',N'存储分区';

-- yj_field:col_name 与 label 同步(引擎按 col_name 取数、label 作前端数据键)
DECLARE @f1 int, @f2 int;
UPDATE yj_field SET col_name=N'存储分区', label=N'存储分区'
WHERE panel_code='WHLOC' AND col_name=N'库区' AND label=N'库区';
SET @f1 = @@ROWCOUNT;

-- yj_translation:ref_key 同步(冲突感知——目标 (scope,ref_key,locale) 已存在则删旧行)
DELETE o FROM yj_translation o
 WHERE o.scope='field' AND o.ref_key=N'库区'
   AND EXISTS (SELECT 1 FROM yj_translation n WHERE n.scope='field' AND n.ref_key=N'存储分区' AND n.locale=o.locale);
UPDATE yj_translation SET ref_key=N'存储分区' WHERE scope='field' AND ref_key=N'库区';
SET @f2 = @@ROWCOUNT;
PRINT N'  ✓ yj_field 改 ' + CAST(@f1 AS nvarchar(10)) + N' 行 / yj_translation 改 ' + CAST(@f2 AS nvarchar(10)) + N' 行';
GO

-- ══════════ 3. 从 `仓位编码` 原文重算坐标列(编码=唯一真源,坐标列=可查询的分解) ══════════
DECLARE @rec int;
UPDATE l SET
  l.区码 = x.区码, l.排号 = x.排号, l.位号 = x.位号, l.层号 = x.层号
FROM dbo.bs_wh_loc l
CROSS APPLY (SELECT
    d1 = CHARINDEX(N'-', l.仓位编码),
    d2 = CHARINDEX(N'-', l.仓位编码, CHARINDEX(N'-', l.仓位编码) + 1)
  ) p
CROSS APPLY (SELECT
    d3 = CASE WHEN p.d2 = 0 THEN 0 ELSE CHARINDEX(N'-', l.仓位编码, p.d2 + 1) END
  ) p2
CROSS APPLY (SELECT
    s1 = LEFT(l.仓位编码, p.d1 - 1),
    s2 = SUBSTRING(l.仓位编码, p.d1 + 1, p.d2 - p.d1 - 1),
    s3 = CASE WHEN p2.d3 = 0 THEN SUBSTRING(l.仓位编码, p.d2 + 1, 50)
              ELSE SUBSTRING(l.仓位编码, p.d2 + 1, p2.d3 - p.d2 - 1) END,
    s4 = CASE WHEN p2.d3 = 0 THEN NULL ELSE SUBSTRING(l.仓位编码, p2.d3 + 1, 50) END
  ) q
CROSS APPLY (SELECT
    -- 首段"前导字母数":'A1'→1(区域族) / 'AH5'→2、'AH'→2(货架族)。
    -- 补 '*' 哨兵:首段全字母时 PATINDEX 会返回 0,哨兵保证算得出长度。
    lead = PATINDEX(N'%[^A-Za-z]%', q.s1 + N'*') - 1
  ) z
CROSS APPLY (SELECT
    -- 区域族(lead=1):首段整体是区码,排/位取第2/3段,无层
    -- 货架族(lead>=2):首段的前导字母是区码、其余数字是排号,位/层取第2/3段
    区码 = CASE WHEN z.lead <= 1 THEN q.s1 ELSE LEFT(q.s1, z.lead) END,
    排号 = CASE WHEN z.lead <= 1 THEN q.s2 ELSE SUBSTRING(q.s1, z.lead + 1, 50) END,
    位号 = CASE WHEN z.lead <= 1 THEN q.s3 ELSE q.s2 END,
    层号 = CASE WHEN z.lead <= 1 THEN NULL ELSE q.s3 END
  ) x
WHERE l.仓库编码 = N'CK-A'
  AND ISNULL(l.asp_cancel,'N') <> 'Y'
  AND l.仓位编码 LIKE N'%-%-%';   -- 只处理规范编码行,垃圾行不动(下一段软删)
SET @rec = @@ROWCOUNT;
PRINT N'  ✓ 坐标列重算 ' + CAST(@rec AS nvarchar(10)) + N' 行';
GO

-- ══════════ 4. 软删试录垃圾行(2026-09-28 admin 手工试录 + 空编码行;可回滚:asp_cancel 置回 'N') ══════════
DECLARE @junk int;
UPDATE dbo.bs_wh_loc SET asp_cancel = N'Y', asp_user2 = N'migration', asp_time2 = SYSDATETIME()
WHERE ISNULL(asp_cancel,'N') <> 'Y'
  AND (
    ISNULL(仓位编码, N'') = N''                    -- 空编码行(测试库快照遗留 2 行)
    OR 仓位编码 NOT LIKE N'%-%-%'                  -- 非规范编码(da5x/d2/s/e/d 等试录值)
  );
SET @junk = @@ROWCOUNT;
PRINT N'  ✓ 软删垃圾行 ' + CAST(@junk AS nvarchar(10)) + N' 行(asp_cancel=Y,可回滚)';
GO

-- ══════════ 5. yj_field 注册 `区码`(seq 33,列序:仓位编码 → 厂区 → 区码 → 存储分区 → 排/位/层 → 仓位地址)+ 九语言译名 ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'区码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'区码', N'区码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 33, 80, 1, 0, 0, 1);

DECLARE @trn int;
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.ref_key, t.locale, t.text, 'manual'
FROM (VALUES
 (N'区码','en',N'Zone Code'),   (N'区码','ja',N'エリアコード'), (N'区码','ko',N'구역 코드'),
 (N'区码','de',N'Zonencode'),   (N'区码','es',N'Código de zona'),(N'区码','fr',N'Code de zone'),
 (N'区码','ru',N'Код зоны'),    (N'区码','th',N'รหัสพื้นที่'),   (N'区码','vi',N'Mã khu vực')
) t(ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                  WHERE x.scope='field' AND x.ref_key=t.ref_key AND x.locale=t.locale);
SET @trn = @@ROWCOUNT;
PRINT N'  ✓ 区码 译名补 ' + CAST(@trn AS nvarchar(10)) + N' 条';
GO

-- ══════════ 6. 验证 ══════════
SELECT N'区码 列存在(应 40)' AS 检查项, CAST(COL_LENGTH('dbo.bs_wh_loc', N'区码') AS nvarchar(10)) AS 值
UNION ALL SELECT N'旧列 库区 残留(应 NULL)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'库区') AS nvarchar(10))
UNION ALL SELECT N'新列 存储分区 存在(应 60)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'存储分区') AS nvarchar(10))
UNION ALL SELECT N'yj_field 仍叫库区(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WHLOC' AND col_name=N'库区'
UNION ALL SELECT N'yj_translation 仍有库区(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE ref_key=N'库区'
UNION ALL SELECT N'WHLOC 字段数(应 12)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='WHLOC'
UNION ALL SELECT N'有效行(应 CK-A 156 + 他仓 0 = 156)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'已软删垃圾(应 ≥5)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE asp_cancel=N'Y'
UNION ALL SELECT N'排号含非数字(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND 排号 LIKE N'%[^0-9]%'
UNION ALL SELECT N'区码为空(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(区码,N'')=N''
UNION ALL SELECT N'坐标组合重复组(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM (
    SELECT 仓库编码,区码,排号,位号,ISNULL(层号,N'') AS c FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
    GROUP BY 仓库编码,区码,排号,位号,ISNULL(层号,N'') HAVING COUNT(*)>1) d;
GO
PRINT N'=== 坐标分解对照(每存储分区首尾各 2 行) ===';
SELECT 存储分区, 区码, 排号, 位号, ISNULL(层号,N'(空)') AS 层号, 仓位编码, 仓位地址
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 存储分区 ORDER BY 仓位编码) AS rn,
            COUNT(*)     OVER (PARTITION BY 存储分区)                 AS cn
  FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-A' AND ISNULL(asp_cancel,'N')<>'Y'
) t WHERE rn <= 2 OR rn > cn - 2
ORDER BY 存储分区, 仓位编码;
GO
PRINT N'migrate-whloc-clean-coord-20261008 完成';
GO
