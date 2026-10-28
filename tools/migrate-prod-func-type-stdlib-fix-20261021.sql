/* =============================================================================
   migrate-prod-func-type-stdlib-fix-20261021.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-21):「产品信息表的功能类别下拉做成一个标准库,可以进行填写维护」。

   ⚠ 这是**返工**。上一版(migrate-prod-func-type-stdlib-20261021.sql)把它做成
     「普通下拉 + dict_sql 读 bs_dict(数据字典面板)」—— 选项是能维护了,但界面上
     **没有「⧉ 标准库维护」按钮**,用户无法就地维护(截图证实:产品形态有该按钮、
     产品功能类别没有)。根因:系统里「标准库」是一个**独立的字段类型**,不是普通下拉。

   正确机制(照 产品形态 的现成做法):
     · yj_field.data_type = N'标准库'
     · yj_field.dict_sql  = lib_code(如 prod.form)
     · 条目落 yj_std_lib(lib_code / item_code / content / seq / enabled)
     · 前端 PanelxForm / RecordSheetPanels 见 data_type='标准库' 就旁挂
       「⧉ 标准库维护」入口(StdLibManager:新增/编辑/停用/恢复启用)

   本脚本:
     ① 把 除余氯/VOC/重金属 搬进 yj_std_lib,lib_code = 'prod.func_type'
     ② 产品功能类别 改回 data_type='标准库' + dict_sql='prod.func_type'
     ③ **回滚上一版**写进 bs_dict 的 3 行(避免两处并存、以后改错地方)
   幂等:①② NOT EXISTS 判重;③ 按 (字典类别,名称) 精确删,重复执行无副作用。
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ---------- ① 条目进标准库 ---------- */
INSERT INTO dbo.yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1, asp_cancel)
SELECT N'prod.func_type', N'默认', v.content, v.seq, 1, N'migration', SYSDATETIME(), 'N'
FROM (VALUES (N'除余氯', 10), (N'VOC', 20), (N'重金属', 30)) AS v(content, seq)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.yj_std_lib s
    WHERE s.lib_code = N'prod.func_type' AND s.content = v.content AND ISNULL(s.asp_cancel,'N') <> 'Y'
);
GO

/* ---------- ② 字段改成「标准库」类型 ---------- */
UPDATE dbo.yj_field
   SET data_type = N'标准库',
       dict_sql  = N'prod.func_type'
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品功能类别';
GO

/* ---------- ③ 回滚上一版写进 bs_dict 的 3 行 ---------- */
DELETE FROM dbo.bs_dict
 WHERE 字典类别 = N'产品功能类别'
   AND 名称 IN (N'除余氯', N'VOC', N'重金属')
   AND asp_user1 = N'migration';
GO

/* ---------- ④ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_std_lib WHERE lib_code = N'prod.func_type' AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'prod.func_type 标准库一条都没写进去', 16, 1);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
               WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品功能类别'
                 AND data_type = N'标准库' AND dict_sql = N'prod.func_type')
    RAISERROR(N'产品功能类别 没有改成 标准库 类型', 16, 1);
GO
IF EXISTS (SELECT 1 FROM dbo.bs_dict WHERE 字典类别 = N'产品功能类别' AND 名称 IN (N'除余氯', N'VOC', N'重金属'))
    RAISERROR(N'bs_dict 里的旧行没清干净(会与标准库并存)', 16, 1);
GO
