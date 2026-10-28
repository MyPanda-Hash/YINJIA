/* =============================================================================
   migrate-prod-ctrl-level-stdlib-20261021.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-21):「产品管控等级也做」—— 接 prod.func_type 之后,把产品信息表里
   另一个写死的下拉也升级成可维护标准库。

   现状(实测):RD_PROD_INFO.产品管控等级 是普通下拉,字典写死:
     SELECT v FROM (VALUES (N'重点产品'),(N'KPC产品'),(N'其他')) AS t(v)
   ⇒ 加一项要改迁移脚本,界面上没有维护入口。

   改法(与 产品功能类别 完全一致,照 产品形态 的现成机制):
     · yj_field.data_type = N'标准库'
     · yj_field.dict_sql  = N'prod.ctrl_level'
     · 条目落 yj_std_lib(lib_code / item_code / content / seq / enabled)
     · 前端见 data_type='标准库' 自动旁挂「⧉ 标准库维护」入口(StdLibManager)

   ⚠ 与 func_type 那次的区别:这次一开始就用正确机制,不走 bs_dict 弯路。
   幂等:NOT EXISTS 判重;UPDATE 结果确定,重复执行无副作用。
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ---------- ① 条目进标准库 ---------- */
INSERT INTO dbo.yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1, asp_cancel)
SELECT N'prod.ctrl_level', N'默认', v.content, v.seq, 1, N'migration', SYSDATETIME(), 'N'
FROM (VALUES (N'重点产品', 10), (N'KPC产品', 20), (N'其他', 30)) AS v(content, seq)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.yj_std_lib s
    WHERE s.lib_code = N'prod.ctrl_level' AND s.content = v.content AND ISNULL(s.asp_cancel,'N') <> 'Y'
);
GO

/* ---------- ② 字段改成「标准库」类型 ---------- */
UPDATE dbo.yj_field
   SET data_type = N'标准库',
       dict_sql  = N'prod.ctrl_level'
 WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品管控等级';
GO

/* ---------- ③ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_std_lib WHERE lib_code = N'prod.ctrl_level' AND ISNULL(asp_cancel,'N') <> 'Y')
    RAISERROR(N'prod.ctrl_level 标准库一条都没写进去', 16, 1);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
               WHERE panel_code = N'RD_PROD_INFO' AND label = N'产品管控等级'
                 AND data_type = N'标准库' AND dict_sql = N'prod.ctrl_level')
    RAISERROR(N'产品管控等级 没有改成 标准库 类型', 16, 1);
GO
