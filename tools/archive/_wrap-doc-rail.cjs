// _wrap-doc-rail.cjs — PanelxList 模板重构:报表块前移 + 单据卡片区包 doc-rail-layout(左栏选择)
const fs = require('fs');
const P = require('path').join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'PanelxList.vue');
let s = fs.readFileSync(P, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const once = (m, tag) => {
  const n = s.split(m).length - 1;
  if (n !== 1) { console.error('标记[' + tag + ']出现 ' + n + ' 次,应为 1'); process.exit(1); }
};

const M_REPORT = '    <div v-if="reportMode" class="report-body" v-loading="loading">';
const M_BODY = '    <div v-else-if="!isApprovalDoc" class="body" :class="{ \'draft-body\': draftEditable }" v-loading="loading && !isBomMasterPanel">';
const M_ELSE = '    <div v-else class="fields header-fields udl-fields" :class="{ \'is-draft\': draftEditable }">';
const M_CTX = '表格右键菜单';

[M_REPORT, M_BODY, M_ELSE, M_CTX].forEach((m, i) => once(m, ['report', 'body', 'else', 'ctx'][i]));

// 1) 摘出报表块(report → body 之前的整段,含尾随空行)
const iReport = s.indexOf(M_REPORT);
const iBody = s.indexOf(M_BODY);
const reportBlock = s.slice(iReport, iBody).replace(/\r?\n+$/, eol);
s = s.slice(0, iReport) + s.slice(iBody);

// 2) 报表块插到 单据 v-else 之前
const iElse = s.indexOf(M_ELSE);
s = s.slice(0, iElse) + reportBlock + eol + s.slice(iElse);

// 3) v-else 头字段行 → wrapper 开口
const WRAPPER_OPEN = [
  '    <template v-else>',
  '      <!-- 单据卡片:左「单据选择」栏(送料暂收单等启用,对齐 PANDA 左停靠选择列表) + 右侧表头/明细 -->',
  '      <div class="doc-rail-layout" :class="{ \'rail-on\': !!docRailCfg && !railCollapsed }">',
  '        <DocSelectRail',
  '          v-if="docRailCfg"',
  '          :title="docRailCfg.title"',
  '          :rows="list"',
  '          :current-no="railCurNo"',
  '          :collapsed="railCollapsed"',
  '          @select="onRailSelect"',
  '          @toggle="railCollapsed = !railCollapsed"',
  '        />',
  '        <div class="doc-rail-main">',
  '          <div class="fields header-fields udl-fields" :class="{ \'is-draft\': draftEditable }">',
].join(eol);
s = s.replace(M_ELSE, WRAPPER_OPEN);

// 4) body 行 v-else-if → v-if(原链对的 reportMode 分支已移出 wrapper)
s = s.replace(M_BODY, M_BODY.replace('v-else-if="!isApprovalDoc"', 'v-if="!isApprovalDoc"'));

// 5) 右键菜单注释前补 wrapper 收口(footer 之后;按标记回退到行首)
const CLOSE = ['        </div>', '      </div>', '    </template>', ''].join(eol);
const iCtx = s.indexOf(M_CTX);
const iCtxLine = s.lastIndexOf(eol, iCtx) + 1;
s = s.slice(0, iCtxLine) + CLOSE + eol + s.slice(iCtxLine);

fs.writeFileSync(P, s);
console.log('OK: report 块前移 + wrapper 包裹完成;长度', s.length);
