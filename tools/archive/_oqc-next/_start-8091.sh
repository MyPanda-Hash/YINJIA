#!/usr/bin/env bash
# _start-8091.sh / _stop-8091.sh —— 8091 并行实例起停(2026-11-04,task-4)
#
# 只碰 8091;绝不碰宿主 8090/5173/1433。pid 落 .tmp/oqc-verify/8091.pid,
# 日志落 .tmp/oqc-verify/logs/8091-app.log。
# 注意:本沙箱里前台命令结束可能连带杀掉它起的子进程;若本脚本起的 java 不能存活,
#      改用 pwsh 后台 job 启动(见 _oqc-next/README.md 的「8091 起停」)。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="$ROOT/.tmp/oqc-verify"
JAR="$WORK/backend-build/target/yinjia-mes-backend-0.1.0.jar"
LOG="$WORK/logs/8091-app.log"
PIDFILE="$WORK/8091.pid"
JAVA='C:/Users/vigna/.jdks/ms-25.0.4/bin/java.exe'
mkdir -p "$WORK/logs"

stop_8091() {
  local pid=""
  if [ -f "$PIDFILE" ]; then pid="$(cat "$PIDFILE" 2>/dev/null || true)"; fi
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    # 兜底:按监听端口找本机 java 的 pid(netstat 第 5 列)
    pid="$(netstat -ano 2>/dev/null | grep -E 'LISTENING' | grep -E '[:.]8091\b' | awk '{print $NF}' | head -1 || true)"
  fi
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    taskkill //PID "$pid" //F 2>/dev/null || kill "$pid" 2>/dev/null || true
    echo "[stop-8091] 已尝试停止 pid=$pid"
  else
    echo "[stop-8091] 8091 未在运行"
  fi
  rm -f "$PIDFILE"
}

start_8091() {
  [ -f "$JAR" ] || { echo "[start-8091][FAIL] jar 不存在: $JAR(先跑 _build-8091.sh)"; exit 1; }
  stop_8091
  : > "$LOG"
  echo "[start-8091] 启动: $JAR --server.port=8091"
  nohup "$JAVA" -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -jar "$JAR" --server.port=8091 >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  echo "[start-8091] pid=$(cat "$PIDFILE") 日志=$LOG"
  # 轮询登录端点(最多 120s;后端启动要连库+初始化,约 20~40s)
  for i in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 2 -X POST http://127.0.0.1:8091/api/auth/login \
      -H 'Content-Type: application/json' -d '{"userName":"admin","password":"123456","factory":"YINJIA-MES"}' || true)"
    if [ "$code" = "200" ]; then echo "[start-8091] OK(第 ${i} 次探测,HTTP 200)"; return 0; fi
    sleep 2
  done
  echo "[start-8091][FAIL] 120s 内未就绪,见日志 $LOG"; tail -30 "$LOG" || true; exit 1
}

case "${1:-start}" in
  start) start_8091 ;;
  stop) stop_8091 ;;
  restart) stop_8091; start_8091 ;;
  status)
    if netstat -ano 2>/dev/null | grep -E 'LISTENING' | grep -qE '[:.]8091\b'; then echo "8091 LISTENING"; else echo "8091 未监听"; fi ;;
  *) echo "用法: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
