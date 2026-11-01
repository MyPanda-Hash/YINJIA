#!/usr/bin/env python3
"""_stage_fix_hunks.py — 只暂存「既有故障修复」的改动(ScheduleBoardService 里混有上一轮日排产改动)。

本提交 = 恢复成型检验单映射(首件/制程),涉及 4 个文件:
  QcInspAutoService.java / ButtonService.java / FirstInspBackfill.java(整文件只有本修复)
  ScheduleBoardService.java(混有上一轮日排产改动 ⇒ 逐 hunk 过滤)
注意:全程按 bytes 处理,避免 text=True 的换行归一化把 CRLF 弄丢导致 patch 不匹配。
"""
import subprocess
import sys

MY_MARKERS = ["2026-10-29 ", "QC_FIRST_INSP", "QC_PROC_INSP", "qc_first_insp_head",
              "qc_proc_insp_head", "现按现役三张单"]

WHOLE = [
    "backend/src/main/java/com/yinjia/mes/service/QcInspAutoService.java",
    "backend/src/main/java/com/yinjia/mes/service/ButtonService.java",
    "backend/src/main/java/com/yinjia/mes/service/FirstInspBackfill.java",
]
MIXED = ["backend/src/main/java/com/yinjia/mes/service/ScheduleBoardService.java"]


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
    # @@ -a[,b] +c[,d] @@
    old = head.split(b" ")[1][1:]
    a = int(old.split(b",")[0])
    b = int(old.split(b",")[1]) if b"," in old else 1
    return a, b


def build(path):
    diff = git("diff", "-U3", "--", path).stdout
    if not diff.strip():
        return None, 0
    header, hunks = parse_hunks(diff)
    out, delta, added = [], 0, 0
    for h in hunks:
        a, b = parse_old(h["head"])
        # hunk 级判定:整个 hunk 是「我的改动」才保留(本修复的 hunk 与日排产 hunk 完全分开)
        if not any(ln.startswith(b"+") and has_any(ln, MY_MARKERS) for ln in h["body"]):
            continue
        kept = list(h["body"])
        add = len([x for x in kept if x.startswith(b"+")])
        dele = len([x for x in kept if x.startswith(b"-")])
        out.append(b"@@ -%d,%d +%d,%d @@\n" % (a, b, a + delta, b + add - dele))
        out.extend(kept)
        delta += add - dele
        added += add
    if not out:
        return None, 0
    head = [ln for ln in header if ln.startswith((b"diff --git", b"index ", b"--- ", b"+++ "))]
    return b"".join(head) + b"".join(out), added


def main():
    apply_mode = "--apply" in sys.argv
    for path in MIXED:
        patch, n = build(path)
        print("[patch] %-70s +%d" % (path, n))
        if apply_mode and patch:
            r = git("apply", "--cached", "--whitespace=nowarn", "-", inp=patch)
            if r.returncode != 0:
                print("!! " + r.stderr.decode("utf-8", "replace")[:2000])
                sys.exit(1)
    if apply_mode:
        r = git("add", "--", *WHOLE)
        if r.returncode != 0:
            print("git add 失败:" + r.stderr.decode("utf-8", "replace")[:1000])
            sys.exit(1)
        print("whole 3 文件已 add")


main()
