// _check-menu-vs-db.cjs — 菜单 panelCode 与 yj_panel 比对,找出"面板不存在"的缺口
const { execSync } = require('child_process');
const codes = require('./_menu-codes.json');
const sql = "SET NOCOUNT ON; SELECT panel_code FROM yj_panel";
const out = execSync(`docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P 'Yinjia@2026' -d HSDZ_MES -C -W -h -1 -Q \\"${sql}\\""`, { encoding: 'utf8' });
const db = new Set(out.split(/\r?\n/).map((l) => l.trim().replace(/\s+$/, '')).filter((l) => /^[A-Z0-9_]+$/.test(l)));
const missing = codes.filter((c) => !db.has(c));
console.log('DB面板数:', db.size, '| 菜单数:', codes.length, '| 菜单有而DB无:', missing.length);
console.log(missing.length ? '缺失:\n' + missing.join('\n') : '(无缺失)');
