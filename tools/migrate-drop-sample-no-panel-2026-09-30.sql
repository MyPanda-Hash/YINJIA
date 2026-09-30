-- migrate-drop-sample-no-panel-2026-09-30.sql
-- 下架「样品编号表」面板 RD_SAMPLE_NO —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   用户口径(2026-09-30):「样品编号表删掉」。

   处置方式 = **下架面板,保留数据表**(用户选定):
     · 删元数据三处:yj_role_panel(权限) / yj_field(字段) / yj_panel(面板);
     · **保留** rd_sample_no_head、rd_sample_no_detail 两张表与其中数据,
       以及 yj_doc_status 里该面板的历史状态行 —— 历史单据仍可查库/可恢复,
       与项目 2026-09-29 下架 pr_* 面板的"元数据清理、数据不动"口径一致;
     · yj_std_lib 的 rd.customer_code(客户项目代号库)保留:它是**可复用的字典**,
       不跟着某一张面板的存废走。
   ⚠ 之所以不 DROP 两张表:删表不可逆,而本面板是"发号台账"性质,
     未来若要复查历史样品编号,数据是唯一凭据。
   ⚠ 本脚本不改 tools/db-inuse-tables.txt 的"在册"判定:两张表仍在册
     (在册台账登记的是**表**在不在用;面板下架后它们转为"历史留档",
      清单文档 docs/development/数据库表清单.md 的关联面板列同批改为「已下架」)。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 权限行
DELETE FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_NO';
GO

-- ② 字段元数据(header/query/detail 全清)
DELETE FROM yj_field WHERE panel_code = N'RD_SAMPLE_NO';
GO

-- ③ 面板登记
DELETE FROM yj_panel WHERE panel_code = N'RD_SAMPLE_NO';
GO

-- ④ 自检:面板/字段/权限三处必须都已清零,两张数据表必须仍在
DECLARE @p int = (SELECT COUNT(*) FROM yj_panel      WHERE panel_code = N'RD_SAMPLE_NO');
DECLARE @f int = (SELECT COUNT(*) FROM yj_field      WHERE panel_code = N'RD_SAMPLE_NO');
DECLARE @r int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'RD_SAMPLE_NO');
DECLARE @head int = (SELECT COUNT(*) FROM sys.tables WHERE name = N'rd_sample_no_head');
DECLARE @det  int = (SELECT COUNT(*) FROM sys.tables WHERE name = N'rd_sample_no_detail');
IF @p = 0 AND @f = 0 AND @r = 0 AND @head = 1 AND @det = 1
  PRINT N'[OK] RD_SAMPLE_NO 面板已下架(面板/字段/权限 0 条);两张数据表保留(1/1)';
ELSE
  PRINT N'[WARN] 结果异常:面板 ' + CAST(@p AS nvarchar(3)) + N' / 字段 ' + CAST(@f AS nvarchar(5))
      + N' / 权限 ' + CAST(@r AS nvarchar(3)) + N' / 表 head=' + CAST(@head AS nvarchar(2))
      + N' detail=' + CAST(@det AS nvarchar(2)) + N'(期望 0/0/0/1/1)';
GO
