// _gen-parity3.cjs — 生成 migrate-server-comment-parity3-20261007.sql(一次性探针)
// 应用集 = (同列不同文案 ∪ 服务器独有) 且服务器文案非空;inh/outh 表级两行豁免(本地 09-30 已重建为流水语义)
const fs = require('fs');
const D = __dirname;
const rows = new Map();
let skippedNull = 0, skippedEmpty = 0, excl = [];
function feed(f, which) {
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const p = line.split('\t');
    if (p.length < 3) continue;
    const tbl = p[0].trim(), col = p[1].trim(), srv = p[2].trim();
    if (srv === '<NULL>') { skippedNull++; continue; }
    if (srv === '') { skippedEmpty++; continue; }
    if (which === 'diverge' && col === '' && (tbl === 'inh' || tbl === 'outh')) { excl.push(tbl); continue; }
    rows.set(tbl + '\t' + col, { tbl, col: col === '' ? null : col, descr: srv });
  }
}
feed(D + '/cmt-diverge.tsv', 'diverge');
feed(D + '/cmt-srv-only.tsv', 'srvonly');
const list = [...rows.values()].sort((a, b) =>
  (a.col === null ? 0 : 1) - (b.col === null ? 0 : 1) || a.tbl.localeCompare(b.tbl) || String(a.col).localeCompare(String(b.col)));
const esc = s => s.replace(/'/g, "''");
let out = [];
out.push(`/* migrate-server-comment-parity3-20261007.sql — 注释层对齐(第三轮 parity):库表 MS_Description 以服务器为准回写本地(2026-10-07)
 * 来源:2026-10-07 12:22 服务器最新 bak(HSDZ_MES-afternoon-2026-10-07-122248.bak)还原为本地分身库后,与正式库逐列注释对比
 *   (共表四分类:共用一致 5137 / 同列不同文案 2501 / 服务器独有 388 / 本地独有 1747,证据 tools/archive/_srv-bak-compare-20261007/)。
 * 用户口径:「当前库表的注释以服务器端的为准,对本地的注释进行修改」。
 * 规则:①对「同列不同文案」与「服务器独有且本地同名列存在」的键,先清本地 MS_Description(兼容 USER 级遗留重复行)再写入服务器文案;
 *   ②本地独有注释(服务器没有的表/列)保留不动;③服务器注释值为 NULL/空 的键跳过;④文案首尾空白裁剪;⑤inh/outh 两行**表级**注释
 *   豁免 —— 本地 2026-09-30 已把两表重建为 入库/出库流水 语义(清单 v1.7),服务器「进货单/出货单」为重建前旧称,不回写;
 *   ⑥只动共表(服务器独有 6 表/视图本就不在本地,不涉及)。
 * ⚠ 已知按服务器原样落库的错位注释:bd_material_out.工单行号 =「打印次数」(服务器侧标错,本地原注为 parity2 入链的正确语义;
 *   如需纠正,单改这一条即可)。幂等:重跑 = 先清后写同值,结果不变;两账套均执行。 */`);
out.push(`SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
IF OBJECT_ID('tempdb..#srv_cmt') IS NOT NULL DROP TABLE #srv_cmt;
CREATE TABLE #srv_cmt (tbl sysname NOT NULL, col sysname NULL, descr nvarchar(1000) NOT NULL);`);
const CH = 400;
for (let i = 0; i < list.length; i += CH) {
  out.push('INSERT INTO #srv_cmt (tbl, col, descr) VALUES');
  out.push(list.slice(i, i + CH).map(r =>
    `(N'${esc(r.tbl)}', ${r.col === null ? 'NULL' : `N'${esc(r.col)}'`}, N'${esc(r.descr)}')`).join(',\n') + ';');
  out.push('GO');
}
out.push(`DECLARE @tbl sysname, @col sysname, @descr nvarchar(1000), @oid int, @cid int, @n int, @try int, @msg nvarchar(500);
SET @n = 0;
DECLARE cr CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, descr FROM #srv_cmt ORDER BY tbl, col;
OPEN cr;
FETCH NEXT FROM cr INTO @tbl, @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @oid = OBJECT_ID(N'dbo.' + @tbl);
  IF @oid IS NOT NULL AND (@col IS NULL OR COL_LENGTH(N'dbo.' + @tbl, @col) IS NOT NULL)
  BEGIN
    SET @cid = CASE WHEN @col IS NULL THEN 0 ELSE COLUMNPROPERTY(@oid, @col, 'ColumnId') END;
    IF @cid IS NOT NULL
    BEGIN
      SET @try = 0;
      WHILE EXISTS (SELECT 1 FROM sys.extended_properties WHERE class = 1 AND major_id = @oid AND minor_id = @cid AND name = N'MS_Description')
      BEGIN
        SET @try += 1;
        IF @try > 5
        BEGIN
          SET @msg = CONCAT(N'parity3 无法清除旧注释: ', @tbl, N'.', ISNULL(@col, N'<表级>'));
          THROW 51000, @msg, 1;
        END
        BEGIN TRY
          IF @col IS NULL EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @tbl;
          ELSE EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        END TRY
        BEGIN CATCH
          IF @col IS NULL EXEC sp_dropextendedproperty N'MS_Description', N'USER', N'dbo', N'TABLE', @tbl;
          ELSE EXEC sp_dropextendedproperty N'MS_Description', N'USER', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        END CATCH
      END
      IF @col IS NULL EXEC sp_addextendedproperty N'MS_Description', @descr, N'SCHEMA', N'dbo', N'TABLE', @tbl;
      ELSE EXEC sp_addextendedproperty N'MS_Description', @descr, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
      SET @n += 1;
    END
  END
  FETCH NEXT FROM cr INTO @tbl, @col, @descr;
END
CLOSE cr; DEALLOCATE cr;
PRINT N'== parity3 完成: 以服务器为准回写 ' + CAST(@n AS nvarchar(10)) + N' 条注释(应约 ${list.length} 条,差额=本地列不存在跳过) ==';
GO`);
fs.writeFileSync('tools/migrate-server-comment-parity3-20261007.sql', out.join('\n') + '\n');
console.log(`应用集 ${list.length} 条(分歧+独有;豁免 ${excl.length} 行: ${excl.join(',')};空值跳过 ${skippedNull};空文案跳过 ${skippedEmpty})`);
console.log('表级:', list.filter(r => r.col === null).length, ' 列级:', list.filter(r => r.col !== null).length);
