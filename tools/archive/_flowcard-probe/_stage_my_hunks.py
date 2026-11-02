#!/usr/bin/env python3
"""_stage_my_hunks.py — 只把「本任务(工序流程追踪卡)」的改动做进暂存区,工作区不动。

背景(2026-10-29):
  工作区里同时躺着上一轮未提交的任务(工单日排产 v3.67 / 生产领料面板 PROD_PICK_LIST 补登记)的改动,
  有些文件两边都改过(PagePanelRegistry / PanelPermissionService / en.js / db-migrations.txt /
  db-inuse-tables.txt / 数据库表清单.md)。按 AGENTS「单任务单提交」纪律,本次提交只能含本任务的行:
  用 `git diff` 逐 hunk 过滤后 `git apply --cached`,再 git add 本任务独有的新增文件。

⚠ 全程按 bytes 处理:避免 text=True 的换行归一化把 CRLF 弄丢导致 patch 不匹配。

用法:
  python _stage_my_hunks.py --check   # 只打印(hunk 级 dry run)
  python _stage_my_hunks.py --apply   # 真正写索引
"""
import subprocess
import sys

# 本任务的身份标记(命中即「是我的」)
MY_MARKERS = [
    "工序流程追踪卡", "PROC_FLOW", "procFlowCard", "工序照片", "小批次", "批次来源",
    "wo_proc_card", "migrate-wo-proc-card", "流程卡", "录入照片", "确认完成", "批次追溯",
    "卡片列表", "_proc-card-", "LZK-",
]
# 上一轮任务的标记(命中即「不是我的」)
PRIOR_MARKERS = [
    "日排产", "wo_day_plan", "dayplan", "DayPlan", "v3.67", "PROD_PICK_LIST", "v_prod_pick_list",
    "7天需交付", "15天需交付", "大于15天", "按完工日期均摊", "migrate-wo-day-plan",
]

# 整文件暂存(内容只有本任务改动)
WHOLE = [
    "backend/src/main/java/com/yinjia/mes/service/ProcCardService.java",
    "backend/src/main/java/com/yinjia/mes/controller/ProcCardController.java",
    "backend/src/main/java/com/yinjia/mes/service/AttachmentService.java",
    "frontend/src/views/modules/plan/ProcFlowCard.vue",
    "frontend/src/views/modules/plan/procFlowCardApi.js",
    "frontend/src/views/modules/plan/procFlowCardEditor.vue",
    "frontend/src/views/modules/plan/procFlowCardPhotos.vue",
    "frontend/src/views/modules/plan/procFlowCardTable.vue",
    "frontend/src/views/modules/plan/procFlowCardTrace.vue",
    "frontend/src/business/menus.js",
    "frontend/src/router/index.js",
    "frontend/src/business/menus.test.js",
    "frontend/src/i18n/locales/ja.js",
    "tools/migrate-wo-proc-card-20261029.sql",
    "docs/design/工序流程追踪卡-V1.0.md",
    "docs/development/工序流程追踪卡-实现与验证.md",
    "tools/archive/_proc-card-rollback-20261029.sql",
]
# 混有上一轮改动的文件 → 逐 hunk 过滤
MIXED = [
    "backend/src/main/java/com/yinjia/mes/service/PagePanelRegistry.java",
    "backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java",
    "frontend/src/i18n/locales/en.js",
    "tools/db-migrations.txt",
    "tools/db-inuse-tables.txt",
    "docs/development/数据库表清单.md",
]
# 整目录暂存(探针/取证);token 类敏感文件排除
DIRS = ["tools/archive/_proc-card-probe", "tools/archive/_flowcard-probe", "tools/archive/_proc-card-verify"]
SECRETS = [".token_admin", ".token_oldjar"]


def git(*args, inp=None):
    return subprocess.run(["git", *args], input=inp, capture_output=True)


def has_any(line, marks):
    text = line.decode("utf-8", "replace")
    return any(m in text for m in marks)


def parse_hunks(diff_bytes):
    header, hunks, cur = [], [], None
    for ln in diff_bytes.splitlines(keepends=True):
        if ln.startswith(b"@@"):
            if cur:
                hunks.append(cur)
            cur = {"head": ln, "body": []}
        elif cur is None:
            header.append(ln)
        else:
            cur["body"].append(ln)
    if cur:
        hunks.append(cur)
    return header, hunks


def parse_old(head):
    old = head.split(b" ")[1][1:]
    a = int(old.split(b",")[0])
    b = int(old.split(b",")[1]) if b"," in old else 1
    return a, b


def build_patch(path):
    diff = git("diff", "-U3", "--", path).stdout
    if not diff.strip():
        return None, 0
    header, hunks = parse_hunks(diff)
    out, delta, added = [], 0, 0
    for h in hunks:
        a, b = parse_old(h["head"])
        # 本任务在这些文件里全是「插入」;带删除行的 hunk 是上一轮/换行归一化噪声 ⇒ 丢
        if any(ln.startswith(b"-") for ln in h["body"]):
            continue
        added_lines = [ln for ln in h["body"] if ln.startswith(b"+")]
        my_adds = [ln for ln in added_lines if has_any(ln, MY_MARKERS)]
        prior_adds = [ln for ln in added_lines if has_any(ln, PRIOR_MARKERS)]
        if not my_adds:
            continue
        if not prior_adds:
            kept = list(h["body"])
        else:
            # 同一 hunk 里混了上一轮的行(如 db-migrations / db-inuse-tables / 表清单):
            #   只丢掉「明确属于上一轮」的行,本任务的行(含注释/空行)整块保留 ——
            #   不能反过来「只留含我标记的行」,否则本任务块里不带关键词的注释行会被切碎。
            kept = []
            for ln in h["body"]:
                if ln.startswith(b"+") and has_any(ln, PRIOR_MARKERS):
                    continue
                kept.append(ln)
        add = len([x for x in kept if x.startswith(b"+")])
        out.append(b"@@ -%d,%d +%d,%d @@\n" % (a, b, a + delta, b + add))
        out.extend(kept)
        delta += add
        added += add
    if not out:
        return None, 0
    head = [ln for ln in header if ln.startswith((b"diff --git", b"index ", b"--- ", b"+++ "))]
    return b"".join(head) + b"".join(out), added


def main():
    apply_mode = "--apply" in sys.argv
    grand = 0
    for path in MIXED:
        patch, n = build_patch(path)
        if not patch:
            print("[skip ] %s" % path)
            continue
        grand += n
        print("[patch] %-78s +%d" % (path, n))
        if apply_mode:
            r = git("apply", "--cached", "--whitespace=nowarn", "-", inp=patch)
            if r.returncode != 0:
                print("  !! apply 失败:\n" + r.stderr.decode("utf-8", "replace")[:3000])
                sys.exit(1)
    print("mixed 合计新增行 = %d" % grand)
    if apply_mode:
        r = git("add", "--", *WHOLE)
        if r.returncode != 0:
            print("git add 失败:" + r.stderr.decode("utf-8", "replace")[:2000])
            sys.exit(1)
        for d in DIRS:
            git("add", "--", d)
        for d in DIRS:
            for s in SECRETS:
                git("reset", "-q", "--", d + "/" + s)
        print("whole 文件/目录已 git add(已排除 token 文件)")


if __name__ == "__main__":
    main()
