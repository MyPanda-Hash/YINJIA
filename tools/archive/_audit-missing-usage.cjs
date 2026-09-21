// _audit-missing-usage.cjs — 只读:52 张缺注表的引用关系(yj_panel 头/行表 / 视图定义引用 / 后端代码引用)
const mssql = require('D:/workspace/yinjia/deploy/node_modules/mssql');
const fs = require('fs');

(async () => {
  const pool = await new mssql.ConnectionPool({
    server: 'localhost', port: 1433, database: 'HSDZ_MES',
    user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false }
  }).connect();
  const q = async (sql) => (await pool.request().query(sql)).recordset;

  // 缺注表(与 _audit-desc.cjs 同口径)
  const missTbl = (await q(`SELECT t.name FROM sys.tables t
    WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description')
    ORDER BY t.name`)).map(r => r.name);

  // 1) yj_panel 头/行表映射
  const panels = await q(`SELECT panel_code, panel_name, head_table, line_table FROM yj_panel`);
  // 2) 视图定义(sm.definition)引用
  const views = await q(`SELECT v.name, m.definition FROM sys.views v JOIN sys.sql_modules m ON m.object_id=v.object_id`);
  // 3) yj_field.dict_sql 里引用的表(参照/字典数据源)
  const dictSqls = await q(`SELECT DISTINCT dict_sql FROM yj_field WHERE dict_sql IS NOT NULL AND dict_sql<>''`);

  await pool.close();

  const backendSrc = (() => {  // 后端 Java 源码里搜表名
    const out = {};
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.java')) { try { out[p] = fs.readFileSync(p, 'utf8'); } catch {} }
    });
    walk('D:/workspace/yinjia/backend/src/main/java');
    return out;
  })();

  const rows = missTbl.map(t => {
    const ps = panels.filter(p => p.head_table === t || p.line_table === t);
    const vs = views.filter(v => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(v.definition || '')).map(v => v.name);
    const dictHit = dictSqls.some(d => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(d.dict_sql));
    const javaHit = Object.entries(backendSrc).filter(([, src]) => src.includes(t)).map(([p]) => p.split('/').slice(-1)[0]);
    return {
      table: t,
      panels: ps.map(p => `${p.panel_code}(${p.panel_name})${p.head_table === t ? '头' : '行'}`),
      views: vs.length, dictSql: dictHit, java: [...new Set(javaHit)].slice(0, 4)
    };
  });

  const noPanel = rows.filter(r => r.panels.length === 0);
  console.log(`缺注表共 ${rows.length} 张;其中 yj_panel 头/行表映射不到的 ${noPanel.length} 张:\n`);
  for (const r of noPanel) console.log(`  ${r.table}  视图引用:${r.views} 字典SQL:${r.dictSql ? 'Y' : '-'} 后端Java:${r.java.join(',') || '-'}`);
  console.log(`\n=== 有面板映射的 ${rows.length - noPanel.length} 张 ===`);
  for (const r of rows.filter(r => r.panels.length)) console.log(`  ${r.table} -> ${r.panels.join(' , ')}`);
  fs.writeFileSync('D:/workspace/yinjia/tools/archive/_audit-missing-usage.json', JSON.stringify(rows, null, 2), 'utf8');
})().catch(e => { console.error(e); process.exit(1); });
