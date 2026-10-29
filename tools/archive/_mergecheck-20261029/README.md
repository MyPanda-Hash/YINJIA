# 2026-10-29 合并 origin/main(124 提交)的核查产物

| 文件 | 用途 |
|---|---|
| `_BatchProbe.java` | 按 GO 分批执行迁移脚本,逐批打印 OK/FAIL —— 定位 DbSync 只报 `Invalid column name '档'` 却不说哪一批 |
| `_probe-dang.sql` | 探针:临时表中文列名「档」在两账套是否可解析(排除排序规则/编码嫌疑,结论:可解析) |
| `_Query.java` | 只读查询探针(面板清单/字段数/行数),合并后冒烟核对 |
| `local-original-migrate-prod-pick-outh-20261022.sql` | **本地在途原版**(2026-10-22 编写、从未入库);远端 10-25 另写了「补登记」版并已进链,合并时以远端版为准,原版留档备查 |

实测结论:两账套 `DbSync sync` 均「执行 0 / 跳过 649 / 失败 0」;`FourDocAudit` 双 PASS;
8091 冒烟(独立 worktree 打包的合并后 jar)登录正常,生产领料 2094 / 混料记录 8 /
供应商采购打印 223 / 菜单设计 143 面板。
