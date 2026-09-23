/* =============================================================================
   库存状况表(STOCK_BALANCE) 查询字段来源改为基础资料
   —— 仓库/存货 由「文本」改「参照」,查询弹窗改走 仓库档案(WH)/存货档案(INV)

   背景(2026-09-21 实测 HSDZ_MES):
     三张库存报表里,台账(STOCK_LEDGER)与收发存汇总表(STOCK_SUMMARY)的 仓库/存货
     早已是 data_type='参照' + ref_panel=WH/INV;只有库存状况表这两列是「文本」,
     前端因此退回自由输入/视图取值,下拉里出现 9 个仓库(含 '(未填仓库)'),
     而仓库档案 bs_wh 只有 6 行 —— 用户要求「字段搜索关联要以基础资料为准」。

     注:yj_field 这两行的 ref_panel/ref_field/display_field 本来就已填好(WH/仓库名称、
     INV/存货名称),只差 data_type,故本迁移只改类型,不新增列。

   口径:
     · 改后 查询弹窗的 仓库 = 仓库档案(6 个,可搜索下拉);存货 = 存货档案(3838 行,
       走参照弹窗/远程搜索),两者都只能从基础资料里选(不再允许手输未建档值)。
     · 面板注册表 PanelRegistry 有 30s TTL,改完 30 秒内自动生效,无需重启后端。

   自检:末尾 SELECT 应输出 2 行 data_type='参照';重复执行不改变结果(幂等)。
   ============================================================================= */
SET NOCOUNT ON;
GO

UPDATE yj_field
   SET data_type = N'参照'
 WHERE panel_code = N'STOCK_BALANCE'
   AND col_name IN (N'仓库', N'存货')
   AND data_type = N'文本';   -- 幂等:已是参照的不再动
GO

PRINT '== 自检:库存状况表的 仓库/存货 应为参照,ref_panel=WH/INV ==';
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place
  FROM yj_field
 WHERE panel_code = N'STOCK_BALANCE' AND col_name IN (N'仓库', N'存货')
 ORDER BY seq;
GO

PRINT '== 对照:三面版口径应一致(参照/WH/INV) ==';
SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field
  FROM yj_field
 WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_SUMMARY', N'STOCK_BALANCE')
   AND col_name IN (N'仓库', N'存货')
 ORDER BY panel_code, seq;
GO
