#!/bin/bash
# 探针:核对 linesSummary 与 scheduled 的口径一致性(2026-11-12 任务)
# 用法: bash probe.sh  (需 8091 临时实例已启动)
TOKEN=$(curl -s -m 5 http://127.0.0.1:8091/api/auth/login -X POST -H "Content-Type: application/json" -d '{"userName":"admin","password":"123456"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
H="Authorization: Bearer $TOKEN"
echo "== linesSummary(左栏口径) =="
curl -s -m 15 http://127.0.0.1:8091/api/px/scheduleBoard/linesSummary -X POST -H "Content-Type: application/json" -H "$H" -d '{}' \
  | tr '{' '\n' | grep '"生产线"' \
  | sed -E 's/.*"生产线":"([^"]*)".*"未交量":([0-9.]+),"本线排产数量":([0-9.]+),"本线已报完工量":([0-9.]+),"本线未完工量":([0-9.]+),"本线行数":([0-9]+).*/\1\t排产=\3\t已报=\4\t未完工=\5\t行=\6\t未交=\2/' \
  | awk -F'\t' '$2!="排产=0.0" || $3!="已报=0.0"'
echo "== scheduled(右侧明细) 三条线 =="
for LINE in '\u88c5\u7bb12(\u65b0\u5382)' '1\u53f7\u8f66\u95f4' '\u5207\u70ad1(\u8001\u5382)'; do
  for SCOPE in '\u672a\u5b8c\u5de5' '\u5df2\u5b8c\u5de5' '\u5168\u90e8'; do
    curl -s -m 15 http://127.0.0.1:8091/api/px/scheduleBoard/scheduled -X POST -H "Content-Type: application/json" -H "$H" \
      -d "{\"\u751f\u4ea7\u7ebf\":\"$LINE\",\"scope\":\"$SCOPE\"}" -o ./_probe_s.json -w "%{http_code} " \
      ; node -e '
        const fs=require("fs");const d=JSON.parse(fs.readFileSync("./_probe_s.json","utf8")).data||[];
        const plan=d.reduce((a,r)=>a+Number(r["本线排产数量"]??r["当前工序计划量"]??0),0);
        const done=d.reduce((a,r)=>a+Number(r["当前工序完工量"]||0),0);
        const left=d.reduce((a,r)=>a+Math.max(Number(r["本线排产数量"]??r["当前工序计划量"]??0)-Number(r["当前工序完工量"]||0),0),0);
        console.log(process.argv[1]+" rows="+d.length+" 排产="+plan+" 已报="+done+" 未完工="+left);
      ' "$SCOPE"
  done
done
