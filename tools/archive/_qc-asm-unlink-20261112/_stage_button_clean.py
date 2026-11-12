"""Staging helper (2026-11-12, disposable): 把「表观单解绑产成品入库」这一件事的改动单独暂存进 ButtonService.java。

背景:ButtonService.java 工作区里还混着**另一个任务**(切炭直销下线)未提交的删除
(dualOutFinishIn / dualOutRedReverse 及其调用)。直接把工作区文件 add 进去会把别人的改动带进本提交。

做法:
  clean = HEAD 版 + 本任务的 6 处改动
   ① validateProcInspQty javadoc 里 asmInspToStock 的过时引用改成新口径;
   ② 弃审里删掉 asmInspUnauditCascade 调用(换成说明注释);
   ③ 审核里删掉 asmInspToStock 调用(换成说明注释);
   ④ 删掉 asmInspToStock 方法体;
   ⑤ 删掉 asmInspUnauditCascade 方法体;
   ⑥ 保留 gdIdOfReport / resolveWoRow / finishWarehouse —— HEAD 里 dualOutFinishIn 还在用它们
      (等切炭直销任务提交后自然变死代码,再由后续提交删),这样本提交单独也能编译通过。
  然后 git update-index --cacheinfo 直接把 clean 版放进暂存区(工作区文件不动)。
另外:把 helpers 重新补回工作区文件(工作区已有 dualOut* 被删,helpers 留着只是暂时未用,不影响编译),
避免提交后工作区出现「helpers 被删」的悬空差异。
"""
import os, subprocess, sys

ROOT = r'D:\workspace\yinjia'
REL = r'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
PATH = os.path.join(ROOT, REL)

head = subprocess.run(['git', 'cat-file', 'blob', 'HEAD:' + REL], cwd=ROOT, capture_output=True, check=True).stdout
txt = head.decode('utf-8')
crlf = '\r\n' in txt
s = txt.replace('\r\n', '\n')

def expect(marker, label):
    if marker not in s:
        print('[FAIL] marker missing:', label)
        sys.exit(1)

def cut(start, end, label, replacement=''):
    global s
    i = s.find(start)
    j = s.find(end, i + 1)
    if i < 0 or j < 0:
        print('[FAIL] cut markers:', label, i, j)
        sys.exit(1)
    s = s[:i] + replacement + s[j:]
    print('[OK] cut', label)

# ①②②③ etc
expect('     *       (asmInspToStock)的口径都会打架,直接拒绝保存。</li>', 'javadoc old ref')
s = s.replace(
    '     *   <li>明细 Σ不合格数量 超过表头检验数量 → 派生合格数为负,追溯页与入库分流\n'
    '     *       (asmInspToStock)的口径都会打架,直接拒绝保存。</li>',
    '     *   <li>明细 Σ不合格数量 超过表头检验数量 → 派生合格数为负,工单追溯「质检数据」段的口径\n'
    '     *       都会打架,直接拒绝保存(2026-11-12 起表观单不再由审核生成产成品入库单,\n'
    '     *       这条守恒只服务追溯汇总,与入库无关)。</li>', 1)

# 弃审调用
OLD_UNAUDIT = ('        // 组装成品检验单弃审联动(2026-10-17):审核时按表头「合格数量」自动生成的**产成品入库单\n'
               '        // 草稿**一并作废+释放占用(已审核则挡弃审,先弃审那张入库单)—— 保证「合格数量只在检验单已审核\n'
               '        // 期间存在于成品入库单里」,改完数量重审会按新值重开一张(见 asmInspUnauditCascade)\n'
               '        asmInspUnauditCascade(def.code(), no, currentUserName());\n')
NEW_UNAUDIT = ('        // 组装成品检验单(出货检验表观)弃审**不再联动产成品入库单**(2026-11-12 用户口径:\n'
               '        //   「入库不和这个单据强关联了,把之前的实现安全去除掉」)⇒ 原 asmInspUnauditCascade 已删除;\n'
               '        //   存量入库单保持现状,弃审检验单不会再去作废/拦截它们。\n')
expect(OLD_UNAUDIT, 'unaudit call')
s = s.replace(OLD_UNAUDIT, NEW_UNAUDIT, 1)

# 审核调用
OLD_AUDIT = ('        // 组装成品检验单 → 合格数转产成品入库单草稿、不合格数转不良品处理单草稿\n'
             '        asmInspToStock(def.code(), no, user);\n')
NEW_AUDIT = ('        // 组装成品检验单审核**不再自动生成产成品入库单**(2026-11-12 用户口径:\n'
             '        //   「入库不和这个单据强关联了,把之前的实现安全去除掉。之后入库数量的进行得调换到其他单据」)\n'
             '        //   ⇒ 原 asmInspToStock 及其数量口径类 AsmInspStockQty 已整体删除;存量已生成的入库单不动。\n')
expect(OLD_AUDIT, 'audit call')
s = s.replace(OLD_AUDIT, NEW_AUDIT, 1)

# 删 asmInspToStock 方法(到 asmInspUnauditCascade 的 javadoc 前)
cut('    /**\n     * 组装成品检验单审核 → 数量分流',
    '    /**\n     * 组装成品检验单**弃审联动**',
    'asmInspToStock method')
# 删 asmInspUnauditCascade 方法(到 成品仓解析 javadoc 前;finishWarehouse 保留给 dualOut)
cut('    /**\n     * 组装成品检验单**弃审联动**',
    '    /**\n     * 成品仓解析(优先成品类启用仓',
    'asmInspUnauditCascade method')

clean = s.replace('\n', '\r\n') if crlf else s
tmp = os.path.join(ROOT, '.tmp-ButtonService-clean.java')
open(tmp, 'w', encoding='utf-8', newline='').write(clean)
sha = subprocess.run(['git', 'hash-object', '-w', '--no-filters', tmp], cwd=ROOT, capture_output=True, check=True, text=True).stdout.strip()
subprocess.run(['git', 'update-index', '--cacheinfo', '100644,%s,%s' % (sha, REL)], cwd=ROOT, check=True)
os.remove(tmp)
print('[OK] staged clean ButtonService.java sha=', sha[:10], 'crlf=', crlf)
print('[CHECK] clean contains dualOutFinishIn:', 'dualOutFinishIn' in clean, '| helpers kept:',
      all(x in clean for x in ['gdIdOfReport', 'resolveWoRow', 'finishWarehouse', 'numOr']))
print('[CHECK] clean contains asmInspToStock/asmInspUnauditCascade:', 'asmInspToStock' in clean, 'asmInspUnauditCascade' in clean)

# ---- 工作区:补回 helpers(工作区已删 dualOut*,helpers 暂未使用但保持与 HEAD 一致,避免悬空删除) ----
cur = open(PATH, encoding='utf-8', newline='').read()
cur_crlf = '\r\n' in cur
w = cur.replace('\r\n', '\n')
if 'private long gdIdOfReport' not in w:
    # 从 HEAD 文本里抠出来原样补回
    hs = txt.replace('\r\n', '\n')
    h_start = hs.find('    /**\n     * 报工单号 → 该单锚定的**排产行id**')
    h_end = hs.find('    // ══════════════════════════════════════════════════════════════════════════════════\n    // 工序检验单', h_start)
    helper_block = hs[h_start:h_end]
    anchor = '    // ══════════════════════════════════════════════════════════════════════════════════\n    // 工序检验单'
    if anchor in w:
        w = w.replace(anchor, helper_block + anchor, 1)
        print('[OK] helpers restored in worktree')
    else:
        print('[WARN] worktree anchor for helpers not found (skip)')
fh_start = hs.find('    /**\n     * 成品仓解析(优先成品类启用仓')
fh_end = hs.find('    // ==================== 来料检验单审核 → 自动生成采购入库单', fh_start)
finish_block = hs[fh_start:fh_end]
if 'private String finishWarehouse' not in w:
    anchor2 = '    // ==================== 来料检验单审核 → 自动生成采购入库单(2026-09-15) ===================='
    if anchor2 in w and fh_start > 0:
        w = w.replace(anchor2, finish_block + anchor2, 1)
        print('[OK] finishWarehouse restored in worktree')
    else:
        print('[WARN] worktree anchor for finishWarehouse not found (skip)')
open(PATH, 'w', encoding='utf-8', newline='').write(w.replace('\n', '\r\n') if cur_crlf else w)
print('[OK] worktree ButtonService.java updated')
