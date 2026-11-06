#!/usr/bin/env bash
# _start-8091.sh —— 8091 并行实例起/停/状态(2026-11-06 独立验证)
# 复制自 tools/archive/_oqc-next/_start-8091.sh,工作目录改 .tmp/qc-insp-verify。
#
# 只碰 8091;绝不碰宿主 8090/5173/1433。pid 落 .tmp/qc-insp-verify/8091.pid,
# 日志落 .tmp/qc-insp-verify/logs/8091-app.log。
# 就绪探测用 **GET /api/base/factory/list**(permitAll,无写库副作用;不反复打登录接口造成使用记录噪音)。
#
# ⚠ 沙箱注记(2026-11-04 实测 danger-full-access 下 nohup 能存活):若本会话后端进程起不来,
#   改用 pwsh 后台 job:
#     pwsh -Command "Start-Process -FilePath 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe' \
#       -ArgumentList '-jar','D:\workspace\yinjia\.tmp\qc-insp-verify\backend-build\target\yinjia-mes-backend-0.1.0.jar','--server.port=8091' \
#       -RedirectStandardOutput 'D:\workspace\yinjia\.tmp\qc-insp-verify\logs\8091-app.log' -WindowStyle Hidden"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="$ROOT/.tmp/qc-insp-verify"
JAR="$WORK/backend-build/target/yinjia-mes-backend-0.1.0.jar"
LOG="$WORK/logs/8091-app.log"
PIDFILE="$WORK/8091.pid"
JAVA='C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
mkdir -p "$WORK/logs"

listening() {
  netstat -ano 2>/dev/null | grep -E 'LISTENING' | grep -qE '[:.]8091\b'
}

stop_8091() {
  local pid=""
  if [ -f "$PIDFILE" ]; then pid="$(cat "$PIDFILE" 2>/dev/null || true)"; fi
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    # 兜底:按监听端口找本机 pid(netstat 第 5 列)
    pid="$(netstat -ano 2>/dev/null | grep -E 'LISTENING' | grep -E '[:.]8091\b' | awk '{print $NF}' | head -1 || true)"
  fi
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    taskkill //PID "$pid" //F 2>/dev/null || kill "$pid" 2>/dev/null || true
    echo "[stop-8091] 已尝试停止 pid=$pid"
    for _ in $(seq 1 15); do listening || break; sleep 1; done
    if listening; then echo "[stop-8091][WARN] 8091 仍在监听"; else echo "[stop-8091] 8091 已停"; fi
  else
    echo "[stop-8091] 8091 未在运行"
  fi
  rm -f "$PIDFILE"
}

start_8091() {
  [ -f "$JAR" ] || { echo "[start-8091][FAIL] jar 不存在: $JAR(先跑 _build-8091.sh)"; exit 1; }
  if listening; then
    echo "[start-8091] 8091 已在监听 —— 先 stop 再起(避免端口冲突)"
    stop_8091
  fi
  : > "$LOG"
  echo "[start-8091] 启动: $JAR --server.port=8091"
  nohup "$JAVA" -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -jar "$JAR" --server.port=8091 >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  echo "[start-8091] pid=$(cat "$PIDFILE") 日志=$LOG"
  # 轮询就绪(最多 150s;后端启动要连库+初始化,约 20~60s)
  for i in $(seq 1 75); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 2 http://127.0.0.1:8091/api/base/factory/list || true)"
    if [ "$code" = "200" ]; then
      # 顺带确认登录端点(YJ_TEST 测试账套;admin/123456 是开发机口令)
      lcode="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST http://127.0.0.1:8091/api/auth/login \
        -H 'Content-Type: application/json' -d '{"userName":"admin","password":"123456","factory":"YJ_TEST"}' || true)"
      echo "[start-8091] OK(第 ${i} 次探测,HTTP 200;登录探测 HTTP ${lcode})"; return 0
    fi
    sleep 2
  done
  echo "[start-8091][FAIL] 150s 内未就绪,见日志 $LOG"; tail -40 "$LOG" || true; exit 1
}

case "${1:-start}" in
  start) start_8091 ;;
  stop) stop_8091 ;;
  restart) stop_8091; start_8091 ;;
  status)
    if listening; then
      echo "8091 LISTENING pid=$(netstat -ano 2>/dev/null | grep -E 'LISTENING' | grep -E '[:.]8091\b' | awk '{print $NF}' | head -1)"
    else echo "8091 未监听"; fi ;;
  *) echo "用法: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
