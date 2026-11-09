/* ============================================================================
   migrate-lab-testitem-legacy-20261109.sql
   实验室「测试项目」标准库补齐服务器上的 4 条**历史遗留条目** —— 2026-11-09

   【需求来源·用户原话】
     「实际服务器是有 5 个测试项目的,本地只有 3 个」

   【为什么本地只有 3 个】
     加标水「测试项目」下拉的候选 = `yj_std_lib` 里 `lib_code='lab.test_item'` 且启用的条目。
     服务器那库里有 7 条:3 条是正规条目(除铅/除汞/除VOC,content 是列结构 JSON),
     另 4 条是**早期手工建的老条目** —— `item_code` 全是「默认」,真正的名字写在 **content 里**
     (纯文本「NSF 42-余氯」/「NSF 42 氯胺 …」/「NSF 42氯胺」/「cs」)。
     前端对「content 不是 JSON」的老式条目按**未设计**渲染(退回内置列集,见
     `frontend/src/core/pages/spikeWaterTemplate.js` 头注释),所以下拉里照样能选到
     「NSF 42-余氯」「NSF 42氯胺」两条 —— 服务器的 5 个就是这么来的。
     本地库是另一条迁移链建出来的,这 4 条老条目从未写进任何脚本 ⇒ 本地只有 3 个。

   【本脚本做什么】
     把这 4 条老条目**原样**补进 `yj_std_lib`(lib_code/item_code/content/seq/enabled 与服务器一致:
     id 411→seq40 启用 / 417→seq50 停用 / 418→seq60 启用 / 419→seq70 停用)。
     其中 2 条 enabled=0(服务器上也是停用,下拉不显示)—— 一并补上,保证**整表一致**,
     将来在「标准库维护」里看到的东西与服务器逐行相同。

   【安全】
     · 只 INSERT,不改/不删任何现有条目;幂等:同 (lib_code, item_code, content) 已存在即跳过;
     · 不改任何单据数据、不改 yj_field/面板元数据;
     · 末尾自检:`lab.test_item` 总数 = 7、启用的纯文本条目恰好 2 条(余氯/氯胺),不过即 THROW。
     · 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @seed TABLE (content nvarchar(400) NOT NULL, seq int NOT NULL, enabled char(1) NOT NULL);
INSERT INTO @seed (content, seq, enabled) VALUES
  (N'NSF 42-余氯',                          40, '1'),
  (N'NSF 42 氯胺  氢氧化钠  次氯酸钠  氯化铵', 50, '0'),
  (N'NSF 42氯胺',                           60, '1'),
  (N'cs',                                   70, '0');

INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT N'lab.test_item', N'默认', s.content, s.seq, s.enabled, N'migrate-lab-testitem-legacy', GETDATE()
  FROM @seed s
 WHERE NOT EXISTS (
         SELECT 1 FROM yj_std_lib x
          WHERE x.lib_code = N'lab.test_item'
            AND x.item_code = N'默认'
            AND x.content = s.content
       );

DECLARE @total int, @legacyOn int;
SELECT @total = COUNT(*) FROM yj_std_lib WHERE lib_code = N'lab.test_item';
SELECT @legacyOn = COUNT(*)
  FROM yj_std_lib
 WHERE lib_code = N'lab.test_item'
   AND item_code = N'默认'
   AND enabled = '1'
   AND content NOT LIKE N'{%';

IF @total <> 7
  RAISERROR(N'[FAIL] lab.test_item 应为 7 条(3 正规 + 4 老条目),实际 %d 条', 16, 1, @total);
IF @legacyOn <> 2
  RAISERROR(N'[FAIL] 启用的纯文本老条目应为 2 条(NSF 42-余氯 / NSF 42氯胺),实际 %d 条', 16, 1, @legacyOn);

COMMIT TRAN;

PRINT N'[PASS] lab.test_item 补齐 4 条历史遗留条目(启用 2 条:NSF 42-余氯 / NSF 42氯胺)';
