#!/usr/bin/env bash
# _build-8091.sh —— 构建「新代码」jar 供 8091 并行实例验证(2026-11-04,task-4)
#
# 为什么另起 8091:8090 是宿主另一会话的旧 jar(被锁,agent 无权重启/替换);
# 本脚本把**当前工作区源码**打成 jar 起在 8091(同一套本机库),只用于验证。
#
# 流程(串行,任一步失败即停):
#   1) cd frontend && npm run build            → frontend/dist
#   2) backend/src + backend/pom.xml → .tmp/oqc-verify/backend-build/(不带 target)
#   3) frontend/dist/* → backend-build/src/main/resources/static(打包前同步,不写工作区 static)
#   4) JAVA_HOME=ms-25 mvn -o -s tools/settings.xml -DskipTests package
#   5) 校验 jar:存在、>50MB、BOOT-INF/lib 条目数、ButtonService 含 "QC_OQC_REPORT"(新代码)
#
# 用法:
#   bash tools/archive/_oqc-next/_build-8091.sh                # 全流程
#   bash tools/archive/_oqc-next/_build-8091.sh --skip-frontend  # 复用已构建的 frontend/dist
#   bash tools/archive/_oqc-next/_build-8091.sh --prepare-only   # 只做 2/3(复制+同步,不打包)
#
# 产物:.tmp/oqc-verify/backend-build/target/yinjia-mes-backend-0.1.0.jar
# 日志:.tmp/oqc-verify/logs/{frontend-build,mvn-package}.log
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="$ROOT/.tmp/oqc-verify"
BUILD="$WORK/backend-build"
LOGS="$WORK/logs"
JAR="$BUILD/target/yinjia-mes-backend-0.1.0.jar"
JAVA_HOME_DEFAULT='C:/Users/vigna/.jdks/ms-25.0.4'
# 注意:会话里可能有 JAVA_HOME=openjdk-23(会报「不支持发行版本 25」),故默认强行钉 ms-25;
# 确需其它 JDK 时用 YJ_JAVA_HOME 覆盖。
export JAVA_HOME="${YJ_JAVA_HOME:-$JAVA_HOME_DEFAULT}"
export PATH="$JAVA_HOME/bin:$PATH"
SKIP_FRONTEND=0
PREPARE_ONLY=0
for a in "$@"; do
  case "$a" in
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --prepare-only) PREPARE_ONLY=1 ;;
    *) echo "[build] 未知参数: $a" >&2; exit 2 ;;
  esac
done
mkdir -p "$LOGS"

echo "== [1/5] 前端构建 =="
if [ "$SKIP_FRONTEND" = 1 ]; then
  echo "[build] --skip-frontend:复用 frontend/dist"
else
  ( cd "$ROOT/frontend" && npm run build ) 2>&1 | tee "$LOGS/frontend-build.log" | tail -8
  [ "${PIPESTATUS[0]}" = 0 ] || { echo "[build][FAIL] 前端构建失败,见 $LOGS/frontend-build.log"; exit 1; }
fi
[ -f "$ROOT/frontend/dist/index.html" ] || { echo "[build][FAIL] frontend/dist/index.html 不存在"; exit 1; }
echo "[build] frontend/dist 大小: $(du -sh "$ROOT/frontend/dist" | cut -f1)"

echo "== [2/5] 复制 backend/src + pom.xml → $BUILD(不带 target)=="
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -r "$ROOT/backend/src" "$BUILD/src"
cp "$ROOT/backend/pom.xml" "$BUILD/pom.xml"
echo "[build] 已复制: $(du -sh "$BUILD/src" | cut -f1) 源码"

echo "== [3/5] 同步 frontend/dist → backend-build/src/main/resources/static(不写工作区) =="
STATIC="$BUILD/src/main/resources/static"
rm -rf "$STATIC"
mkdir -p "$STATIC"
cp -r "$ROOT/frontend/dist/." "$STATIC/"
echo "[build] static 大小: $(du -sh "$STATIC" | cut -f1);入口 $(ls "$STATIC"/assets/index-*.js 2>/dev/null | head -1)"

if [ "$PREPARE_ONLY" = 1 ]; then
  echo "[build] --prepare-only:到此为止(未打包)"; exit 0
fi

echo "== [4/5] mvn package(offline,-DskipTests,JAVA_HOME=$JAVA_HOME)=="
( cd "$BUILD" && mvn -o -s "$ROOT/tools/settings.xml" -DskipTests package ) 2>&1 | tee "$LOGS/mvn-package.log" | tail -15
[ "${PIPESTATUS[0]}" = 0 ] || { echo "[build][FAIL] mvn package 失败,见 $LOGS/mvn-package.log"; exit 1; }
[ -f "$JAR" ] || { echo "[build][FAIL] jar 未生成: $JAR"; exit 1; }

echo "== [5/5] jar 自检 =="
SIZE=$(stat -c%s "$JAR")
[ "$SIZE" -gt 50000000 ] || { echo "[build][FAIL] jar 只有 $SIZE 字节(疑似瘦 jar),应为 50MB+"; exit 1; }
LIBS=$(unzip -l "$JAR" | grep -c 'BOOT-INF/lib/.*\.jar' || true)
HIT=$(unzip -p "$JAR" BOOT-INF/classes/com/yinjia/mes/service/ButtonService.class 2>/dev/null | grep -c 'QC_OQC_REPORT' || true)
echo "[build] jar: $JAR"
echo "[build] 大小: $SIZE 字节 ($(du -h "$JAR" | cut -f1));BOOT-INF/lib 依赖 $LIBS 个;ButtonService 含 QC_OQC_REPORT = $HIT"
[ "$LIBS" -ge 100 ] || { echo "[build][FAIL] BOOT-INF/lib 条目过少=$LIBS(疑似瘦 jar)"; exit 1; }
[ "$HIT" -ge 1 ] || { echo "[build][FAIL] jar 内 ButtonService 不含 QC_OQC_REPORT(不是新代码)"; exit 1; }
echo "[build] OK: $JAR"
