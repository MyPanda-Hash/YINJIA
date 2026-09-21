// _audit-desc.cjs — 只读审计:本地库注明覆盖全量体检 + 补写失败风险预检(不写任何数据)
// 产物:stdout 摘要 + tools/archive/_audit-desc-result.json(全量明细)
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql');
const fs = require('fs');

(async () => {
  const pool = await new mssql.ConnectionPool({
    server: 'localhost', port: 1433, database: 'HSDZ_MES',
    user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false }
  }).connect();
  const q = async (sql) => (await pool.request().query(sql)).recordset;

  const collation = (await q(`SELECT CAST(SERVERPROPERTY('Collation') AS nvarchar(128)) AS srv, CAST(DATABASEPROPERTYEX(DB_NAME(),'Collation') AS nvarchar(128)) AS db`))[0];

  // 1) 缺表级注明的表(全量)
  const missTbl = (await q(`SELECT t.name FROM sys.tables t
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description')
    ORDER BY t.name`)).map(r => r.name);

  // 2) 全部表名(供与迁移脚本比对死条目)
  const allTbl = (await q(`SELECT name FROM sys.tables ORDER BY name`)).map(r => r.name);

  // 3) 缺列级注明的列(全量,含 yj_field 可否反查)
  const missCol = await q(`SELECT t.name tbl, c.name col,
      CASE WHEN EXISTS (SELECT 1 FROM yj_field f WHERE f.col_name = c.name AND f.label IS NOT NULL AND f.label <> '') THEN 1 ELSE 0 END AS field_resolvable
    FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      WHERE ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description')
    ORDER BY t.name, c.name`);

  // 4) 缺注明视图(全量)
  const missView = (await q(`SELECT v.name FROM sys.views v
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      WHERE ep.major_id=v.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description')
    ORDER BY v.name`)).map(r => r.name);

  // 5) 已有注明长度分布(最长 5 条;sp_addextendedproperty 上限 7500 字节)
  const maxLen = await q(`SELECT TOP 5 OBJECT_NAME(ep.major_id) obj, ep.minor_id, LEN(CAST(ep.value AS nvarchar(max))) len
    FROM sys.extended_properties ep WHERE ep.name=N'MS_Description'
    ORDER BY LEN(CAST(ep.value AS nvarchar(max))) DESC`);

  await pool.close();

  // ── 分类:JS 侧正则判 CJK(不依赖库排序规则) ──
  const cjk = /[\u4e00-\u9fff]/;
  const cols = missCol.map(r => ({ ...r, is_cjk: cjk.test(r.col), is_asp: /^asp_/.test(r.col) }));
  const byTbl = {};
  for (const c of cols) {
    byTbl[c.tbl] = byTbl[c.tbl] || { cjk: 0, asp: 0, ascii_resolvable: 0, ascii_manual: 0, manual_cols: [] };
    const b = byTbl[c.tbl];
    if (c.is_cjk) b.cjk++;
    else if (c.is_asp) b.asp++;
    else if (c.field_resolvable) b.ascii_resolvable++;
    else { b.ascii_manual++; b.manual_cols.push(c.col); }
  }

  // ── 与 tools/migrate-table-comments.sql 清单比对 ──
  const script = fs.readFileSync('D:/workspace/yinjia/tools/migrate-table-comments.sql', 'utf8');
  const listed = new Set();
  for (const m of script.matchAll(/\(N'([^']+)',\s*N'/g)) listed.add(m[1]);
  const dupInScript = [...listed].length !== (script.match(/\(N'([^']+)',\s*N'/g) || []).length;
  const coveredByScript = missTbl.filter(t => listed.has(t));
  const notCoveredByScript = missTbl.filter(t => !listed.has(t) && !/_bak_20260911|^RENAME_20260911/.test(t));
  const bakTables = missTbl.filter(t => /_bak_20260911|^RENAME_20260911/.test(t));
  const deadEntries = [...listed].filter(t => !allTbl.includes(t)); // 脚本列了但库里没有(执行时跳过)

  // ── 与 deploy/sync-db-comments.sql(2026-09-18 生成)比对 ──
  const syncFile = fs.existsSync('D:/workspace/yinjia/deploy/sync-db-comments.sql')
    ? fs.readFileSync('D:/workspace/yinjia/deploy/sync-db-comments.sql', 'utf8') : '';
  const coveredBySync = missTbl.filter(t => syncFile.includes(`dbo.${t}')`));
  const notCoveredBySync = missTbl.filter(t => !syncFile.includes(`dbo.${t}')`) && !/_bak_20260911|^RENAME_20260911/.test(t));

  const sum = {
    collation, missing_table_total: missTbl.length,
    missing_col_total: cols.length,
    col_cjk: cols.filter(c => c.is_cjk).length,
    col_asp: cols.filter(c => c.is_asp).length,
    col_ascii_resolvable: cols.filter(c => !c.is_cjk && !c.is_asp && c.field_resolvable).length,
    col_ascii_manual: cols.filter(c => !c.is_cjk && !c.is_asp && !c.field_resolvable).length,
    missing_view_total: missView.length,
    script_listed_total: [...listed].length, script_has_duplicates: dupInScript,
    script_covers_missing_tables: coveredByScript.length,
    script_not_covering: notCoveredByScript,
    script_dead_entries: deadEntries,
    bak_rename_tables_without_desc: bakTables,
    sync_covers_missing_tables: coveredBySync.length,
    sync_not_covering: notCoveredBySync,
    max_existing_desc_len: maxLen,
  };

  fs.writeFileSync('D:/workspace/yinjia/tools/archive/_audit-desc-result.json',
    JSON.stringify({ summary: sum, missing_tables: missTbl, missing_views: missView, missing_cols_by_table: byTbl, missing_cols_all: cols }, null, 2), 'utf8');

  console.log('=== 摘要 ===');
  console.log(JSON.stringify({ ...sum, max_existing_desc_len: maxLen.length + '条(最长 ' + (maxLen[0]?.len || 0) + ' 字符)' }, null, 2));
  console.log('\n=== 缺列分布(按表,仅列需人工的列名) ===');
  for (const [t, b] of Object.entries(byTbl)) {
    console.log(`${t}: 中文列缺${b.cjk} 审计列缺${b.asp} 可反查${b.ascii_resolvable} 需人工${b.ascii_manual}${b.manual_cols.length ? ' -> ' + b.manual_cols.join(',') : ''}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
