// _gen-comments-v2.mjs — 从本地库导出全部 MS_Description + 自动补缺(表←yj_panel,列←yj_field)
// 产物: deploy/sync-db-comments.sql (幂等,对象不存在自动跳过,视图用 VIEW 类型;临时探针,用完归档)
import mssql from 'mssql';
import { writeFileSync } from 'node:fs';

const pool = await new mssql.ConnectionPool({ server: 'localhost', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false } }).connect();
const q = (sql) => pool.request().query(sql);

// 1) 现有 MS_Description 全量(表+视图+列,带对象类型)
const have = (await q(`SELECT s.name sch, o.name tbl, o.type otype, c.name col, CAST(ep.value AS nvarchar(max)) descr
  FROM sys.extended_properties ep
  JOIN sys.objects o ON o.object_id = ep.major_id AND o.type IN ('U','V')
  JOIN sys.schemas s ON s.schema_id = o.schema_id
  LEFT JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.class = 1 AND ep.name = N'MS_Description'`)).recordset;

// 2) 无表描述的表 ← yj_panel 头/行表映射
const tblFill = (await q(`WITH miss AS (SELECT t.object_id oid, s.name sch, t.name tbl FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.minor_id=0 AND ep.name=N'MS_Description' AND ep.major_id=t.object_id))
  SELECT m.sch, m.tbl, MIN(p.panel_name) AS pname, MAX(CASE WHEN p.head_table = m.tbl THEN 1 ELSE 0 END) AS is_head
  FROM miss m LEFT JOIN yj_panel p ON p.head_table = m.tbl OR p.line_table = m.tbl
  GROUP BY m.sch, m.tbl`)).recordset;

// 3) 无列描述且列名为拼音/英文的列 ← yj_field 最高频标签
const colFill = (await q(`WITH miss AS (SELECT t.name tbl, c.name col FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.name=N'MS_Description' AND ep.major_id=t.object_id AND ep.minor_id=c.column_id)
      AND c.name NOT LIKE N'%[一-鿿]%')
  SELECT x.tbl, x.col, x.label FROM
    (SELECT m.tbl AS tbl, m.col AS col, f.label AS label,
            ROW_NUMBER() OVER (PARTITION BY m.tbl, m.col ORDER BY COUNT(*) DESC) AS rn
     FROM miss m JOIN yj_field f ON f.col_name = m.col WHERE f.label IS NOT NULL AND f.label <> ''
     GROUP BY m.tbl, m.col, f.label) x WHERE x.rn = 1`)).recordset;
await pool.close();

const esc = (v) => String(v).replace(/'/g, "''");
const lines = [
  '-- sync-db-comments.sql — 服务器库表/列/视图中文注明对齐脚本(从开发库导出+自动补缺,2026-09-18)',
  '-- 幂等:有则更新无则新增;对象在服务器不存在时自动跳过;视图用 N\'VIEW\' 类型;每 400 条一批(GO)防单错毁全批',
  'SET NOCOUNT ON;',
];
const emit = (stmts) => { lines.push(...stmts); if (lines.length > 1600 && lines[lines.length - 1] !== 'GO') lines.push('GO'); };
const objProps = (otype) => (otype === 'V' ? ["N'SCHEMA', N'@sch', N'VIEW', N'@tbl'"] : ["N'SCHEMA', N'@sch', N'TABLE', N'@tbl'"]);
const addObj = (sch, tbl, otype, col, descr) => {
  const l1 = otype === 'V' ? 'VIEW' : 'TABLE';
  const tail = col ? `, N'COLUMN', N'${esc(col)}'` : '';
  const target = col ? `COLUMNPROPERTY(OBJECT_ID(N'${esc(sch)}.${esc(tbl)}'), N'${esc(col)}', 'ColumnId')` : '0';
  const existCond = col
    ? `ep.major_id=OBJECT_ID(N'${esc(sch)}.${esc(tbl)}') AND ep.minor_id=${target} AND ep.name=N'MS_Description'`
    : `major_id=OBJECT_ID(N'${esc(sch)}.${esc(tbl)}') AND minor_id=0 AND name=N'MS_Description'`;
  const guard = col ? `IF COL_LENGTH(N'${esc(sch)}.${esc(tbl)}', N'${esc(col)}') IS NOT NULL` : `IF OBJECT_ID(N'${esc(sch)}.${esc(tbl)}') IS NOT NULL`;
  emit([guard,
    `  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ${existCond})`,
    `    EXEC sp_updateextendedproperty N'MS_Description', N'${esc(descr)}', N'SCHEMA', N'${esc(sch)}', N'${l1}', N'${esc(tbl)}'${tail};`,
    `  ELSE EXEC sp_addextendedproperty N'MS_Description', N'${esc(descr)}', N'SCHEMA', N'${esc(sch)}', N'${l1}', N'${esc(tbl)}'${tail};`]);
};
for (const r of have) addObj(r.sch, r.tbl, String(r.otype).trim(), r.col, r.descr);
let nTF = 0; const noPanel = [];
for (const r of tblFill) {
  if (r.pname) { addObj(r.sch, r.tbl, 'U', null, `「${r.pname}」${r.is_head ? '头表' : '明细行表'}`); nTF++; }
  else noPanel.push(r.tbl);
}
let nCF = 0;
for (const r of colFill) { addObj('dbo', r.tbl, 'U', r.col, r.label); nCF++; }
writeFileSync('D:/workspace/yinjia/deploy/sync-db-comments.sql', lines.join('\n') + '\n', 'utf8');
console.log(`已有注明 ${have.length} 条(含视图); 表补 ${nTF} 条(无面板映射 ${noPanel.length} 张); 列补 ${nCF} 条; 共 ${lines.length} 行`);
