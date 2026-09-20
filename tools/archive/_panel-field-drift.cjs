// 一次性排查(v2):静态提取全部 tools/*.sql 对 yj_field 的插入/删除,与本地库全面板比对。
// v2 修正:①CRLF 行尾致链登记解析0;②纳入 _bs_part2_meta 等非 migrate- 前缀脚本。
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const toolsDir = 'D:/workspace/yinjia/tools';
const regRaw = fs.readFileSync(path.join(toolsDir, 'db-migrations.txt'), 'utf8');
const chain = regRaw.split(/\r?\n/).map(s => s.trim()).filter(s => /^[a-z][\w-]*\.sql$/i.test(s));
const diskScripts = fs.readdirSync(toolsDir).filter(f => f.endsWith('.sql'));
const untracked = diskScripts.filter(f => !chain.includes(f));
console.log(`迁移链登记 ${chain.length} 个;磁盘未登记 ${untracked.length} 个:${untracked.join(', ')}`);
// 库现状
const q = execSync(`docker exec mssql2019 /opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P "Yinjia@2026" -d HSDZ_MES -C -W -s "|" -Q "SET NOCOUNT ON; SELECT panel_code+'|'+col_name FROM yj_field"`, { encoding: 'utf8' });
const libByPanel = new Map();
for (const l of q.split(/\r?\n/)) {
  if (!l.includes('|')) continue;
  const [p, c] = l.trim().split('|');
  if (!libByPanel.has(p)) libByPanel.set(p, new Set());
  libByPanel.get(p).add(c);
}
const knownPanels = new Set(libByPanel.keys());
console.log(`库中面板数 ${knownPanels.size},字段总数 ${[...libByPanel.values()].reduce((a, s) => a + s.size, 0)}`);
// 全脚本回放(链序在前,未登记按名序)
const insByPanel = new Map(), delByPanel = new Map();
const keepSets = new Map(); // panel -> [Set(保留清单)] (DELETE ... NOT IN 形式)
const ordered = [...chain.filter(f => diskScripts.includes(f)), ...untracked];
for (const f of ordered) {
  const txt = fs.readFileSync(path.join(toolsDir, f), 'utf8');
  for (const stmt of txt.split(/;\s*(?:\r?\n|--)/)) {
    if (/INSERT\s+INTO\s+yj_field/i.test(stmt)) {
      for (const m of stmt.matchAll(/\(\s*'([A-Za-z0-9_]+)'\s*,\s*N?'([^']+)'/g)) {
        const panel = m[1];
        if (!knownPanels.has(panel)) continue;
        if (!insByPanel.has(panel)) insByPanel.set(panel, new Set());
        insByPanel.get(panel).add(m[2]);
      }
    }
    if (/DELETE\s+FROM\s+yj_field/i.test(stmt)) {
      const panels = new Set();
      const pmEq = stmt.match(/panel_code\s*=\s*N?'([A-Za-z0-9_]+)'/i);
      if (pmEq && knownPanels.has(pmEq[1])) panels.add(pmEq[1]);
      const pmIn = stmt.match(/panel_code\s+IN\s*\(([^)]*)\)/i);
      if (pmIn) for (const pm of pmIn[1].matchAll(/N?'([A-Za-z0-9_]+)'/g)) if (knownPanels.has(pm[1])) panels.add(pm[1]);
      for (const panel of panels) {
        if (!delByPanel.has(panel)) delByPanel.set(panel, new Set());
        const inList = stmt.match(/col_name\s+IN\s*\(([^)]*)\)/i);
        const notIn = stmt.match(/col_name\s+NOT\s+IN\s*\(([^)]*)\)/i);
        if (notIn) {
          const keep = new Set([...notIn[1].matchAll(/N?'([^']+)'/g)].map(m => m[1]));
          if (!keepSets.has(panel)) keepSets.set(panel, []);
          keepSets.get(panel).push(keep);
          delByPanel.get(panel).add('*KEEP*');
        } else if (inList) for (const cm of inList[1].matchAll(/N?'([^']+)'/g)) delByPanel.get(panel).add(cm[1]);
        else delByPanel.get(panel).add('*ALL*');
      }
    }
  }
}
console.log('\n===== 链终态 vs 本地库 差异面板 =====');
let drift = 0;
for (const panel of [...new Set([...insByPanel.keys(), ...libByPanel.keys()])].sort()) {
  const ins = insByPanel.get(panel) || new Set(), del = delByPanel.get(panel) || new Set();
  const allDel = del.has('*ALL*');
  const chainFinal = new Set([...ins].filter(c => !del.has(c)));
  const lib = libByPanel.get(panel) || new Set();
  const missInLib = [...chainFinal].filter(c => !lib.has(c));
  const extraInLib = [...lib].filter(c => !chainFinal.has(c));
  if (missInLib.length || extraInLib.length) {
    drift++;
    console.log(`${panel}: 链应=${chainFinal.size} 库=${lib.size}${allDel ? ' [链上有整面板DELETE(中性化版不执行)]' : ''}`);
    if (missInLib.length) console.log(`   库缺(${missInLib.length}): ${missInLib.join(', ')}`);
    if (extraInLib.length) console.log(`   库多(${extraInLib.length}): ${extraInLib.join(', ')}`);
  }
}
console.log(`\n差异面板总数: ${drift}`);
