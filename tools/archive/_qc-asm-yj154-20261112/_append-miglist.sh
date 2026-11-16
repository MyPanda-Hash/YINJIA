#!/usr/bin/env bash
# 一次性:把本次迁移登记进 tools/db-migrations.txt 末尾(只追加 3 行:空行 + 注释 + 脚本名;CRLF 与该文件一致)
set -euo pipefail
f=/d/workspace/yinjia/tools/db-migrations.txt

if grep -qF 'migrate-qc-asm-insp-batch-table-20261112.sql' "$f"; then
  echo "[SKIP] 已登记,无需重复追加"
  exit 0
fi

printf '\r\n# 2026-11-12 出货检验表观(QC_ASM_INSP,原组装成品检验单)接图2 表样:qc_asm_insp_* 加 内部批次 / 内部批次清单 / 表单审核人 + yj_field 三行 + 总结论·处理方式改下拉 + 4 个字段标签译名(面板显示名/代号/底表/前缀 ZJ 不动)\r\nmigrate-qc-asm-insp-batch-table-20261112.sql\r\n' >> "$f"
echo "[OK] 已追加 3 行"
