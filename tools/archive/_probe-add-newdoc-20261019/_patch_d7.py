# 把踩坑台账 D7 升级成 2026-10-19 单号重发事故的完整记录(一次性补丁脚本)
import io

p = 'docs/development/开发与质量.md'
s = io.open(p, encoding='utf-8').read()
old = ("| D7 | `s_allno` 台账与业务表可能不一致:台账缺号的单据编号会被 `FormNoService.next()` **重发**"
       "(`exists()` 只查 s_allno/inh,不查业务表)⇒ 同号两行、保存写到错误的行 | 探针建单后先验\"该编号在业务表只有 1 行\""
       "再断言,否则读到旧行造成假放行;发现台账缺号按 `tools/archive/_chk-no-reissue.cjs` 盘点后再定补号方案 |")
new = ("| D7 | 🔴 **号池缺号 = 新增重发库里已有的号(2026-10-19 用户报障「点新增出来一张已审核单」)**:"
       "`FormNoService.next()` 原来**只看号池自己** —— `seq=MAX(RIGHT(dh,4)) FROM s_allno`,`exists()` 只查 s_allno+inh,"
       "不看业务表。9 月导库那批单(金蝶导入/演示数据)是直接写库、没回登号池(实测库里 SL 已到 `SL-2026-10-0130`、池只到 `0006`)"
       "⇒ 新增发出去的 `SL-2026-10-0032` 库里**已有一张 9 月的已审核单**,两行共用一个单号、共用一条 `yj_doc_status`(shr=admin)⇒ "
       "新草稿一出生就显示**已审核**、保存被 409「已审核单据不可保存」挡下;列表按单号 GROUP BY 把两行并成一行,"
       "用户看到的就是「新增出来一张已审核单」(同批 qc_insp 101 张单号也全不在池里) | "
       "**代码已改(不可回退)**:取号基准 = `max(号池末号, 各业务表同前缀同月最大号)`,候选号再逐个比对 号池 + inh + **本前缀对应的业务表**"
       "(头行式查头表、单表式查行表,表/列取自 `yj_panel`,见 `FormNoService.docTables`);`next()` 加 `synchronized`,同 JVM 并发不再同号。"
       "**数据侧**:`tools/migrate-formno-pool-sync-20261019.sql`(清空白占位重号头行 + 号池回登,两账套都要跑);"
       "**体检**:`tools/archive/_probe-add-newdoc-20261019/DupProbe.java`(重号/未回登必须 [PASS]);"
       "**端到端**:同目录 `_verify-add-newdoc.mjs`(新增→草稿→可保存→删除)。⚠ 探针建单后仍要先验「该编号在业务表只有 1 行」再断言 |")
assert old in s, 'D7 row not found'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('D7 updated')
