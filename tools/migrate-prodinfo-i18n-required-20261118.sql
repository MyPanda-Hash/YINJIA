/* ============================================================================
 * migrate-prodinfo-i18n-required-20261118.sql
 *   产品信息表（RD_PROD_INFO）新版式的两处收尾补丁
 * ----------------------------------------------------------------------------
 * 背景：2026-11-18 合并 origin/main 后上线的新版式（见
 *   migrate-prodinfo-labels-and-size-20261118.sql）留下两个缺口，本脚本补上：
 *
 *   ① 新/改名的 5 个字段标签**没有任何 yj_translation 译名**
 *      （立项编号 / 立项名称 / 整体外径 / 整体内径 / 整体长度）。
 *      按 AGENTS §2.1「新增面板、字段必须同时交付多语言数据，否则视为功能未完成」，
 *      切换英语后这几格会露中文（只靠机翻兜底）。此处按仓库惯例补 10 语种。
 *      标签名参考 i18n-rd-progress-18cols.sql（同义的「项目编号/项目名称」译名）。
 *
 *   ② 旧聚合格「产品整体尺寸」仍是 required=1（由 migrate-prodinfo-required-20261112.sql 置的），
 *      但新版式纸面**只画三内格**、不再画这一整格 ⇒ 提交审批时的必填校验会要求填一个
 *      界面上看不到的框（RD_PROD_INFO 的 yj_panel.config 没有 fieldNames 白名单，
 *      校验走「所有非 hidden 字段」）。用户口径：三格才是录入位，聚合列只留历史值。
 *      ⇒ 这里只把 required 归 0，**保留 visible=1 与物理列**（历史值照常可查、编辑面板可见）。
 *
 * 幂等 / 两账套：译名 NOT EXISTS 守卫；required 只在 =1 时改。
 * ⚠ 不动任何业务数据、不改 label、不加列。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- ① 译名（10 语种 × 5 标签，只补缺的） ---------- */
DECLARE @t TABLE (lbl nvarchar(50), loc nvarchar(20), txt nvarchar(100));
INSERT INTO @t (lbl, loc, txt) VALUES
 (N'立项编号','en',N'Project No.'),          (N'立项编号','ja',N'プロジェクト番号'),
 (N'立项编号','ko',N'프로젝트 번호'),          (N'立项编号','zh-TW',N'專案編號'),
 (N'立项编号','es',N'N.º de proyecto'),      (N'立项编号','de',N'Projekt-Nr.'),
 (N'立项编号','fr',N'N° de projet'),         (N'立项编号','ru',N'Номер проекта'),
 (N'立项编号','vi',N'Số dự án'),             (N'立项编号','th',N'หมายเลขโครงการ'),

 (N'立项名称','en',N'Project Name'),         (N'立项名称','ja',N'プロジェクト名'),
 (N'立项名称','ko',N'프로젝트명'),             (N'立项名称','zh-TW',N'專案名稱'),
 (N'立项名称','es',N'Nombre del proyecto'),  (N'立项名称','de',N'Projektname'),
 (N'立项名称','fr',N'Nom du projet'),        (N'立项名称','ru',N'Название проекта'),
 (N'立项名称','vi',N'Tên dự án'),            (N'立项名称','th',N'ชื่อโครงการ'),

 (N'整体外径','en',N'Overall OD'),           (N'整体外径','ja',N'全体外径'),
 (N'整体外径','ko',N'전체 외경'),               (N'整体外径','zh-TW',N'整體外徑'),
 (N'整体外径','es',N'DE total'),             (N'整体外径','de',N'Gesamt-AD'),
 (N'整体外径','fr',N'OD total'),             (N'整体外径','ru',N'Общий наружный диаметр'),
 (N'整体外径','vi',N'Đường kính ngoài tổng'),(N'整体外径','th',N'เส้นผ่านศูนย์กลางนอกโดยรวม'),

 (N'整体内径','en',N'Overall ID'),           (N'整体内径','ja',N'全体内径'),
 (N'整体内径','ko',N'전체 내경'),               (N'整体内径','zh-TW',N'整體內徑'),
 (N'整体内径','es',N'DI total'),             (N'整体内径','de',N'Gesamt-ID'),
 (N'整体内径','fr',N'ID total'),             (N'整体内径','ru',N'Общий внутренний диаметр'),
 (N'整体内径','vi',N'Đường kính trong tổng'),(N'整体内径','th',N'เส้นผ่านศูนย์กลางในโดยรวม'),

 (N'整体长度','en',N'Overall Length'),       (N'整体长度','ja',N'全体長さ'),
 (N'整体长度','ko',N'전체 길이'),               (N'整体长度','zh-TW',N'整體長度'),
 (N'整体长度','es',N'Longitud total'),       (N'整体长度','de',N'Gesamtlänge'),
 (N'整体长度','fr',N'Longueur totale'),      (N'整体长度','ru',N'Общая длина'),
 (N'整体长度','vi',N'Chiều dài tổng'),       (N'整体长度','th',N'ความยาวโดยรวม');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', d.lbl, d.loc, d.txt, N'manual'
  FROM @t d
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = d.lbl AND x.locale = d.loc);
PRINT N'[prodinfo-fix] 译名新增行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N'（已存在的自动跳过）';
GO

/* ---------- ② 旧聚合格「产品整体尺寸」必填归 0（保留可见与历史值） ---------- */
UPDATE yj_field
   SET required = 0
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品整体尺寸'
   AND ISNULL(required, 0) = 1;
PRINT N'[prodinfo-fix] 产品整体尺寸 required 归 0 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ③ 自检 ---------- */
DECLARE @ok int;
SELECT @ok = COUNT(*) FROM (
    SELECT ref_key FROM yj_translation
     WHERE scope = N'field'
       AND ref_key IN (N'立项编号', N'立项名称', N'整体外径', N'整体内径', N'整体长度')
       AND locale IN (N'en', N'ja', N'ko', N'zh-TW', N'es', N'de', N'fr', N'ru', N'vi', N'th')
     GROUP BY ref_key HAVING COUNT(DISTINCT locale) >= 10) x;
IF @ok <> 5 RAISERROR(N'[FAIL] 5 个标签里满 10 语种的只有 %d 个', 16, 1, @ok);

IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO'
            AND label = N'产品整体尺寸' AND ISNULL(required, 0) = 1)
    RAISERROR(N'[FAIL] 产品整体尺寸 仍是 required=1', 16, 1);

PRINT N'[PASS] 自检通过：5 标签 × 10 语种译名齐备；产品整体尺寸 required=0（visible/历史值保留）';
GO
