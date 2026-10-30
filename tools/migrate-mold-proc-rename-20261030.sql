/* ============================================================================
   migrate-mold-proc-rename-20261030.sql
   「成型工艺清单」→「烧结工艺清单」显示名变更（2026-10-30）

   【用户口径·原话】
     「系统上现有的成型文件内容就是改成<烧结工艺清单>入口」
     「烧结面板 3页（就是现有的）：1.配方 2.工艺 3.修订记录」

   【只改显示名，不动 panel_code】
     panel_code 仍是 RD_MOLD_PROC —— 全前端 94 处引用它（参照链、四文件编辑门禁、
     产品编号 -tb 后缀、配方计算回填、分发责任人、弃审联动…），改 code 等于重建整条链。
     本次仅把 yj_panel.panel_name 改掉，让菜单/看板/参照弹窗的标题统一显示「烧结工艺清单」；
     前端 menus.js 与 PanelxList.DEV_PANELS 的硬编码标题同批改（那两个不从库里读）。

   【刻意不动的地方】
     · RD_CHANGE「变更文件」勾选项里的字面值 '成型工艺清单'
       —— 它是**历史数据的键**（rd_change_detail 已存的行就是这 4 个字），
       改了会让老单据的勾选项对不上、链接跳不过去。要改得先做数据迁移，另案处理。
     · 各类注释/文档里的旧称：不影响界面，保留历史语境。

   ⚠ 两账套都要跑（先 HSDZ_MES 后 HSDZ_MES_TEST），已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

UPDATE yj_panel
   SET panel_name = N'烧结工艺清单'
 WHERE panel_code = 'RD_MOLD_PROC'
   AND panel_name <> N'烧结工艺清单';

DECLARE @n int = @@ROWCOUNT;

/* 面板译名：新名要有自己的词条，否则切到英语会回落到旧中文名 */
DECLARE @tr TABLE (locale varchar(10), txt nvarchar(500));
INSERT INTO @tr (locale, txt) VALUES
    ('en',    N'Sintering Process List'),
    ('ja',    N'焼結工程リスト'),
    ('zh-TW', N'燒結工藝清單'),
    ('ko',    N'소결 공정 목록'),
    ('vi',    N'Danh sách quy trình thiêu kết');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'烧结工艺清单', t.locale, t.txt, 'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                   WHERE x.scope='panel' AND x.ref_key=N'烧结工艺清单' AND x.locale=t.locale);

/* 自检 */
DECLARE @name nvarchar(50) = (SELECT panel_name FROM yj_panel WHERE panel_code='RD_MOLD_PROC');
DECLARE @trn int = (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'烧结工艺清单');

PRINT N'[DB] ' + @db;
PRINT N'[OK] RD_MOLD_PROC.panel_name = ' + ISNULL(@name, N'NULL')
    + N'，面板译名 ' + CAST(@trn AS nvarchar(5)) + N'/5';

IF @name <> N'烧结工艺清单' OR @trn < 5
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:改名未生效或译名缺失,已回滚', 16, 1, @db);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 成型工艺清单 → 烧结工艺清单';
