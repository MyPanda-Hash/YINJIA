-- migrate-norm-debt-20260929.sql — 数据库规范存量债修复(体检 03/09 项;2026-09-29)
--
-- 背景:未用表清理任务收尾跑 DbNormAudit 时,正式库与测试库(改动前快照)同时报同样两条 FAIL,
--   逐项查证与本次改动无关,属 2026-09-28 那批迁移留下的存量债:
--   · 03 拼写/英文列缺中文注明 6 处:yj_user 的 MobId/PrintNa/phoneNo/usertype/islogin/dlxz
--     (由 tools/migrate-server-parity-20260928.sql 对齐服务器结构时引入;backend/src/main/java
--      全仓无引用,属遗留对齐列)。规范 §2.4:列级必须有中文注明 ⇒ 补注明并如实标注「遗留」。
--   · 09 缺 en 译名 2 处:字段标签 最新成本(INV 等面板)、预警数量(STOCK_STATUS)。
--     多语言强制规范:新增字段必须带 en 译名 ⇒ 补 yj_translation(scope='field', source='manual')。
--   · 09 追加 1 处(2026-09-29 并合 origin/main 后两账套复检发现):字段标签 检验方案(QC_INSP 表头,
--     由 migrate-qcinsp-header-fix.sql 补登表头字段时引入)。该标签在 scope='panel' 已有全套人工/机翻译名
--     (en='Inspection plan', source='manual'),但缺 scope='field' 行 ⇒ 按 panel 行逐语言补齐(见文末)。
-- 幂等:注明按「有则更新、无则新增」;译名按「不存在才插」。

SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ── 03:yj_user 6 个遗留对齐列补中文注明 ──
DECLARE @c TABLE (col sysname PRIMARY KEY, descr nvarchar(200));
INSERT INTO @c (col, descr) VALUES
  (N'MobId',    N'移动端标识(遗留:HSDZ 服务器对齐列,本项目未使用)'),
  (N'PrintNa',  N'打印名(遗留:HSDZ 服务器对齐列,本项目未使用)'),
  (N'phoneNo',  N'手机号(遗留:HSDZ 服务器对齐列,本项目未使用)'),
  (N'usertype', N'用户类型(遗留:HSDZ 服务器对齐列,本项目未使用)'),
  (N'islogin',  N'是否已登录(遗留:HSDZ 服务器对齐列,本项目未使用)'),
  (N'dlxz',     N'登录小组(遗留:HSDZ 服务器对齐列,本项目未使用;含义未确认)');
DECLARE @col sysname, @d nvarchar(200), @done int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @c WHERE COL_LENGTH('yj_user', col) IS NOT NULL;
OPEN cur; FETCH NEXT FROM cur INTO @col, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
             WHERE ep.major_id = OBJECT_ID('yj_user') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('yj_user'), @col, 'ColumnId')
               AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'yj_user', N'COLUMN', @col;
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'yj_user', N'COLUMN', @col;
  SET @done += 1;
  FETCH NEXT FROM cur INTO @col, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'yj_user 列注明补齐: ' + CAST(@done AS nvarchar(10)) + N' 列';
GO

-- ── 09:两个字段标签补 en 译名(至少 en,人工译名 source='manual') ──
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'最新成本' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最新成本', 'en', N'Latest Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'预警数量' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预警数量', 'en', N'Alert Quantity', 'manual');
GO

-- ── 09(追加,2026-09-29 并合 origin/main 后复检):字段标签 检验方案 补 scope='field' 全套译名 ──
-- 直接复用同标签 scope='panel' 的既有译名(含人工 en='Inspection plan'),逐语言补缺、已有的跳过。
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'检验方案')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  SELECT 'field', N'检验方案', p.locale, p.text, p.source
  FROM yj_translation p
  WHERE p.scope = 'panel' AND p.ref_key = N'检验方案'
    AND NOT EXISTS (SELECT 1 FROM yj_translation f
                    WHERE f.scope = 'field' AND f.ref_key = N'检验方案' AND f.locale = p.locale);
GO

-- 核对:全库应无「字段标签缺 en 译名」(排除白名单免译标签由 DbNormAudit 09 项判)
SELECT N'字段标签缺 en 译名(预期与本脚本相关项 0)' AS 检查项, CAST(COUNT(*) AS nvarchar(20)) AS 值
FROM (SELECT f.label FROM yj_field f
      WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                        WHERE t.scope = 'field' AND t.ref_key = f.label AND t.locale = 'en')
        AND f.label IN (N'最新成本', N'预警数量', N'检验方案')) x;
GO
