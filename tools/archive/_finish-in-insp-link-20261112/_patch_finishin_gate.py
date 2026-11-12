"""Patch (2026-11-12 phase2a): FINISH_IN 保存/提交/审核门禁 —— 关联两张出货检验单 + 该批次双合格。

在 ButtonService.java 插入:
  · 私有方法 assertFinishInInspLink / checkInspBatchAudited(放在"状态机"段之前);
  · audit() / submitApproval() / approveApproval() / approveSecond() 入口各调用一次。
幂等:已存在则不重复插入。
"""
import os, sys

PATH = r'D:\workspace\yinjia\backend\src\main\java\com\yinjia\mes\service\ButtonService.java'
raw = open(PATH, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')

HELPER = '''    // ══════════════════════════════════════════════════════════════════════════════════
    // 产成品入库单(FINISH_IN)与两张出货检验单的**关联门禁**(2026-11-12 用户口径)
    //   用户原话:「修改当前的产成品入库,让他需要关联当前的出货检验功能记录表和出货检验表观,
    //   当这两个完成后按照每天的批次实现对这个产成品入库单的入库数量进行填写和创建。」
    //   确认口径:表头两个参照字段必填;两张单都必须**已审核**;本单批次必须同时出现在两张单的明细
    //   「内部批次」里、且两单该批次的每一行都判「合格」才允许入库(任一行未判/不合格即拒绝)。
    //   ⚠ 只门禁 MES 自建单(外部单据号为空):金蝶导入的历史入库单没有这两张检验单,不追溯。
    //   ⚠ 只在 提交审批/审批通过/审核 三个**真正产生库存**的入口校验;保存草稿不拦(仓库可边填边存)。
    // ══════════════════════════════════════════════════════════════════════════════════
    private void assertFinishInInspLink(String no) {
        if (no == null || no.isBlank()) return;
        java.util.List<java.util.Map<String, Object>> hs = jdbc.queryForList(
                "SELECT ISNULL(外部单据号,N'') AS ext, ISNULL(出货检验功能单号,N'') AS func,"
                        + " ISNULL(出货检验表观单号,N'') AS look, ISNULL(批次号,N'') AS batch"
                        + " FROM bd_finish_in WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y'", no);
        if (hs.isEmpty()) return;   // 单据不存在由 ensureDocExists 兜底,这里不重复抛
        java.util.Map<String, Object> h = hs.get(0);
        String ext = String.valueOf(h.get("ext") == null ? "" : h.get("ext")).trim();
        if (!ext.isEmpty()) return; // 金蝶导入的历史单:不纳入本门禁
        String func = String.valueOf(h.get("func") == null ? "" : h.get("func")).trim();
        String look = String.valueOf(h.get("look") == null ? "" : h.get("look")).trim();
        String batch = String.valueOf(h.get("batch") == null ? "" : h.get("batch")).trim();
        if (func.isEmpty() || look.isEmpty())
            throw new IllegalStateException("产成品入库单必须关联「出货检验功能单号」和「出货检验表观单号」后才能提交审批/审核");
        if (batch.isEmpty())
            throw new IllegalStateException("请先填写本单「批次号」(一张入库单对应一个生产日期批次)");
        checkInspBatchAudited("出货检验功能", "QC_PROC_INSP", "qc_proc_insp_detail", func, batch);
        checkInspBatchAudited("出货检验表观", "QC_ASM_INSP", "qc_asm_insp_detail", look, batch);
    }

    /** 单张检验单校验:已审核 + 该批次有记录 + 该批次所有行都判「合格」 */
    private void checkInspBatchAudited(String label, String panel, String detailTable, String docNo, String batch) {
        String status = String.valueOf(docStatusOf(panel, docNo).get("status"));
        if (!"已审核".equals(status))
            throw new IllegalStateException("「" + label + "」" + docNo + " 当前是「" + status + "」,必须已审核才能入库");
        java.util.Map<String, Object> c = jdbc.queryForMap(
                "SELECT COUNT(*) AS total,"
                        + " SUM(CASE WHEN ISNULL([结果判断],N'') <> N'合格' THEN 1 ELSE 0 END) AS bad"
                        + " FROM " + detailTable
                        + " WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([内部批次],N'')=?",
                docNo, batch);
        long total = c.get("total") == null ? 0L : ((Number) c.get("total")).longValue();
        long bad = c.get("bad") == null ? 0L : ((Number) c.get("bad")).longValue();
        if (total == 0L)
            throw new IllegalStateException("「" + label + "」" + docNo + " 里没有批次「" + batch + "」的检验记录,请核对批次号");
        if (bad > 0L)
            throw new IllegalStateException("批次「" + batch + "」在「" + label + "」里存在未判合格/不合格的检验项,不能入库");
    }

'''
GATE = '        if ("FINISH_IN".equals(def.code())) assertFinishInInspLink(no);\n'

if 'assertFinishInInspLink' in s:
    print('[SKIP] already patched')
    sys.exit(0)

def insert_after(marker, extra, label, occurrence=1):
    global s
    idx = -1
    start = 0
    for _ in range(occurrence):
        idx = s.find(marker, start)
        if idx < 0:
            print('[FAIL] marker missing:', label)
            sys.exit(1)
        start = idx + len(marker)
    s = s[:start] + extra + s[start:]
    print('[OK] inserted', label)

# 0) helper:插在"状态机"段注释之前
insert_after('    // ============ 状态机(照搬 light-mes:草稿⇄已审核 + 审批流) ============\n',
             '\n' + HELPER, 'helpers')

# 1) audit():requireNo+ensureDocExists 之后
audit_start = s.find('    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {')
audit_marker = '        String no = requireNo(formData);\n        ensureDocExists(def, no);\n'
audit_idx = s.find(audit_marker, audit_start)
if audit_idx < 0:
    print('[FAIL] audit marker'); sys.exit(1)
insert_at = audit_idx + len(audit_marker)
s = s[:insert_at] + GATE + s[insert_at:]
print('[OK] gate in audit()')

# 2) submitApproval():同一 marker(方法内)
sub_start = s.find('    private Map<String, Object> submitApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {')
sub_idx = s.find(audit_marker, sub_start)
if sub_idx < 0:
    print('[FAIL] submit marker'); sys.exit(1)
insert_at = sub_idx + len(audit_marker)
s = s[:insert_at] + GATE + s[insert_at:]
print('[OK] gate in submitApproval()')

# 3) approveApproval()
app_marker = '    private Map<String, Object> approveApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {\n        String no = requireNo(formData);\n'
app_idx = s.find(app_marker)
if app_idx < 0:
    print('[FAIL] approve marker'); sys.exit(1)
insert_at = app_idx + len(app_marker)
s = s[:insert_at] + GATE + s[insert_at:]
print('[OK] gate in approveApproval()')

# 4) approveSecond()(二级审批通过也产生"已审核")
sec_marker = '    private Map<String, Object> approveSecond(PanelRegistry.PanelDef def, String no, String operator,'
sec_idx = s.find(sec_marker)
if sec_idx >= 0:
    body_start = s.find('{', sec_idx) + 1
    # 在该方法体开头插入
    s = s[:body_start] + '\n        if ("FINISH_IN".equals(def.code())) assertFinishInInspLink(no);' + s[body_start:]
    print('[OK] gate in approveSecond()')
else:
    print('[WARN] approveSecond() not found (skip)')

open(PATH, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('[OK] written, crlf=', crlf)
