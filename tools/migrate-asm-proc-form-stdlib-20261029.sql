/* =============================================================================
   migrate-asm-proc-form-stdlib-20261029.sql
   -----------------------------------------------------------------------------
   用户口径(2026-10-29):「研发管理的组装工艺清单的所有 tap 的工艺形态改为标准库,
                          可以自己新增删除维护」。

   现状(RD_ASM_PROC.工艺形态):
     data_type = N'下拉框'
     dict_sql  = SELECT v FROM (VALUES (N'裸棒'),(N'机器包布'),(N'复合半成品'),(N'成品')) AS t(v)
   ⇒ 手写死的 4 个值,界面上**没有维护入口**(普通下拉不挂「⧉ 标准库维护」)。

   正确机制(与 产品形态/产品功能类别/检查频率 完全一致,不新造概念):
     · yj_field.data_type = N'标准库'
     · yj_field.dict_sql  = 库编码 'asm.form'
     · 条目落 yj_std_lib(lib_code='asm.form', item_code='默认', content=形态名)
     · 前端 RecordSheetPanels 见 data_type='标准库' 就旁挂
       「⧉ 标准库维护」入口(StdLibManager:新增/编辑/停用/恢复启用/彻底删除)

   ⚠ 关键设计:新库 asm.form 与既有 asm.proc **是两个库,不能合并**
     asm.proc  = 关键控制清单的**内容**(一变体一条目,item_code=变体名,content=工序 JSON 数组);
     asm.form  = 工艺形态下拉的**候选词**(一条一个形态名,content=形态名,item_code 统一 '默认')。
     合并会让 StdLibManager 把变体 JSON 当形态名显示,也会让 asm.proc 勾选弹窗多出无 rows 的条目。
     两者**默认同集**(裸棒/机器包布/复合半成品/成品),但此后可各自独立增删 ——
     这正是用户要的「可以自己新增删除维护」。

   数据兼容:rd_asm_proc_head.[工艺形态] 已存在的值(实测 1 行 复合半成品)原样保留;
     历史单据里的文本不随库变动(与其它标准库字段同一口径)。

   幂等:种子按 (lib_code, content) 判重;字段 UPDATE 带窄条件 + 行数守卫。
   两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================= */
SET NOCOUNT ON;
GO

/* ---------- ① 标准库种子(库编码 asm.form) ---------- */
DECLARE @lib nvarchar(50) = N'asm.form';
DECLARE @items TABLE (content nvarchar(200), seq int);
INSERT INTO @items (content, seq) VALUES
 (N'裸棒', 10),
 (N'机器包布', 20),
 (N'复合半成品', 30),
 (N'成品', 40);

INSERT INTO yj_std_lib (lib_code, item_code, content, enabled, seq, asp_user1, asp_time1)
SELECT @lib, N'默认', i.content, 1, i.seq, N'migration', SYSDATETIME()
FROM @items i
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib x
                  WHERE x.lib_code = @lib AND x.content = i.content
                    AND ISNULL(x.asp_cancel, N'N') <> N'Y');
PRINT N'[OK] asm.form 种子: ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 条新增';
GO

/* ---------- ② 工艺形态 改为「标准库」类型(全部页签共用同一表头字段) ---------- */
DECLARE @n int;
UPDATE yj_field
   SET data_type = N'标准库',
       dict_sql  = N'asm.form'
 WHERE panel_code = N'RD_ASM_PROC'
   AND col_name   = N'工艺形态';
SET @n = @@ROWCOUNT;
PRINT N'[OK] 工艺形态 字段改为标准库下拉: ' + CAST(@n AS nvarchar(4)) + N' 行(应为 1)';
IF @n = 0
  PRINT N'[WARN] 未更新任何字段,请核对 panel_code / col_name';
GO

/* ---------- ③ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'RD_ASM_PROC' AND col_name = N'工艺形态'
                 AND data_type = N'标准库' AND dict_sql = N'asm.form')
  RAISERROR(N'工艺形态 没有改成 标准库 类型 / dict_sql 不是 asm.form', 16, 1);
GO
DECLARE @s int = (SELECT COUNT(*) FROM yj_std_lib
                  WHERE lib_code = N'asm.form' AND ISNULL(asp_cancel, N'N') <> N'Y');
IF @s < 4
  RAISERROR(N'asm.form 标准库条目不足 4 条', 16, 1);
GO
-- asm.proc 必须**不受影响**(它承载关键控制清单内容,一并改掉会让变体勾选弹窗失效)
DECLARE @p int = (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N'asm.proc' AND ISNULL(asp_cancel, N'N') <> N'Y');
IF @p <> 4
  PRINT N'[WARN] asm.proc 条目数 = ' + CAST(@p AS nvarchar(4)) + N'(应为 4,本脚本不应改动它)';
ELSE
  PRINT N'[OK] asm.proc 仍为 4 条,未被本脚本改动';
GO
PRINT N'migrate-asm-proc-form-stdlib-20261029.sql 完成';
GO