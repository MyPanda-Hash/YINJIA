#!/usr/bin/env bash
# 一键验收(测试账套 HSDZ_MES_TEST):
#   夹具 → 接口 → 查库 → 清理。跑完必须看到「接口验收 5/5 PASS」且查库全 PASS、清理全 0。
# 用法:bash tools/archive/_finish-in-failqty-20261118/probe/run-verify.sh [http://127.0.0.1:8091]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
JAVA="${JAVA_HOME:-C:/Users/vigna/.jdks/ms-25.0.4}/bin/java"
CP="$REPO/tools/lib/mssql-jdbc.jar"
RUN="$REPO/tools/SqlRunner.java"
URL='jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false'
BASE="${1:-http://127.0.0.1:8091}"

run_sql() {
  "$JAVA" -Dstdout.encoding=UTF-8 -cp "$CP" "$RUN" "$URL" yinjia 'Yinjia@2026' "$1"
}

echo "### 1/4 夹具(两张草稿 + T410 开关置 1)"
run_sql "$HERE/fixture-setup.sql" || { echo '[ABORT] 夹具失败'; exit 1; }

echo
echo "### 2/4 接口验收($BASE)"
node "$HERE/api-check.mjs" "$BASE"
API_RC=$?

echo
echo "### 3/4 查库复核"
run_sql "$HERE/verify-db.sql"

echo
echo "### 4/4 清理夹具 + 还原 T410 开关"
run_sql "$HERE/fixture-cleanup.sql"

exit $API_RC
