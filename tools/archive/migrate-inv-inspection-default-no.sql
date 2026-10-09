-- 【已退场 2026-10-08】本脚本(2026-10-03 建)目标列已不存在,且其意图已被表结构本身满足:
--   ① 它写的是 bs_inv 的物理列「来料检验」——该列 2026-09-28 已随金蝶口径改名为「是否来料检验」;
--   ② 改名后的「是否来料检验」不是普通列而是**计算列**(建列见 tools/migrate-po-inbound-fields.sql:20):
--        [是否来料检验] AS CASE WHEN RTRIM(ISNULL(检验方式,''))='1' THEN N'是' ELSE N'否' END
--      ⇒ 计算列不可 UPDATE、不可挂 DEFAULT,值恒为 是/否、永不为 NULL ——「空值」这一情形不可能出现。
--   ③ 实测证据(2026-10-08,两个账套一致):sys.computed_columns 中存在上述定义、is_computed=1;
--      DbSync 跑本脚本连报两次失败(列名 '来料检验' 无效 → 不能修改计算列)并中止整条迁移链。
-- 处置:从 tools/db-migrations.txt 移出、归档于此,不再执行(做法同 cleanup-base-panels.sql 先例)。
-- 遗留(不阻塞):若服务器侧仍是旧结构(普通列「来料检验」),按《部署说明》的全量恢复路线会被本地库
--   整体覆盖,不必为它保留回填动作;将来若真发现服务器该列有空值,按新列的计算口径另写新脚本。
-- 原文见 git 历史(退场前路径 tools/migrate-inv-inspection-default-no.sql)。
SET NOCOUNT ON;
PRINT N'migrate-inv-inspection-default-no: 已退场(2026-10-08)—— 目标列已改名且为计算列,空值口径由结构保证,本次跳过';
GO
