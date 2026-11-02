# _stage-only-mine.py — 把「本任务」的 hunk 单独暂存(同一文件里混着别的未提交任务改动时用)
#
# 背景:frontend/src/views/modules/plan/WorkOrderList.vue 里,除了本次「批量排产」改动外,
# 还有别的任务未提交的一行(打印下拉「切炭生产任务单」)。直接 git add 整个文件会夹带别人的改动
# (违反 AGENTS「单任务单提交/不夹带其它任务改动」),故用本脚本从完整 diff 里剔除指定 hunk,
# 只把剩下的 hunk apply --cached 进 index;工作区内容不动。
#
# 用法(在仓库根执行):
#   git diff -- <file> > /tmp/all.patch
#   python tools/archive/_batch-sched-20261030/_stage-only-mine.py /tmp/all.patch /tmp/mine.patch "切炭生产任务单"
#   git apply --cached /tmp/mine.patch
import sys

src, dst, drop = sys.argv[1], sys.argv[2], sys.argv[3]
with open(src, encoding='utf-8') as f:
    lines = f.readlines()

header = []
hunks = []
cur = None
for ln in lines:
    if ln.startswith('@@'):
        if cur is not None:
            hunks.append(cur)
        cur = [ln]
    elif cur is None:
        header.append(ln)
    else:
        cur.append(ln)
if cur is not None:
    hunks.append(cur)

kept = [h for h in hunks if drop not in ''.join(h)]
with open(dst, 'w', encoding='utf-8', newline='') as f:
    f.write(''.join(header))
    for h in kept:
        f.write(''.join(h))
print('hunks total=%d kept=%d dropped=%d' % (len(hunks), len(kept), len(hunks) - len(kept)))
