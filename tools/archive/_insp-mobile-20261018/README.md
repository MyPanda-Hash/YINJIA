# 检验单改为「报工量达标即出单」—— 取证与回归探针（2026-10-18）

用户口径（原话）：

> 当前手机端报工是直接写入当前数据库的……将当前的检验单生成的形式可以修改为当前排产转产线
> 相同的形式实现，**只要当前报工数量达到当前要求就可以进入到下一步**。

## 1. 备份库取证（`deploy/HSDZ_MES-manual-20261018-132950.bak`）

`restore2.sql` 把备份还原成本机临时库 `HSDZ_MES_MB20261018`（sa / 容器 `mssql2019`）：

```
docker cp deploy/HSDZ_MES-manual-20261018-132950.bak mssql2019:/var/opt/mssql/data/mb20261018.bak
# 用 tools/lib/mssql-jdbc.jar 跑 restore2.sql（sa/Yinjia@2026）
```

关键事实（`q13.sql`）：

| 工单 | 工序 | 报工行 | 报工量 | 报工单号 | 结论 |
|---|---|---|---|---|---|
| GD-2026-10-0011 | 成型 / 切炭 / 组装 | 2086/2087/2088 | 270 / 270 / 270 | **空**（手机端直写） | 改动前：三张检验单一张都没有 |
| GD-2026-10-0220 | 成型 | 1085/1086 | 158+160=318 | 空 | 同上 |
| GD-2026-10-0007 | 成型/切炭/组装 | 76/78/79 | 161/161/160 | 有报工单（旧） | 该行无 `plang_pc`，吸收跳过 |

`wo_process_line.计划数量` = 270（0011 三道）、160（0220 成型），与 `q6` 实测一致。

## 2. 验证方式（2026-10-18 实测）

临时实例（**不碰 8090 正式实例**）：

```
cd backend
SPRING_DATASOURCE_URL="jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_MB20261018;..." \
  mvn -o spring-boot:run -Dspring-boot.run.arguments="--server.port=8091 --yinjia.enable-test-ledger=false"
```

登录 `admin/123456` 后 `POST /api/px/scheduleBoard/absorbMobile {"days":3}`；
定时任务（每分钟）也会自行吸收。

生成结果（`q13.sql` / `q15.sql`）：

| 单据 | 工单 | 工序 | 批次 | 报工数量 |
|---|---|---|---|---|
| `SJ-2026-10-0063`（首件） | GD-2026-10-0011 | 成型 | 20261018 | 270 |
| `ZC-2026-10-0031`（制程） | GD-2026-10-0011 | 成型 | 20261018 | 270 |
| `ZJ-2026-10-0017`（组装成品） | GD-2026-10-0011 | 组装 | 20261018 | 270 |
| `SJ-2026-10-0062` / `ZC-2026-10-0030` | GD-2026-10-0220 | 成型 | 20261014 | 318 |

`form_flow_link` 写入 `source_panel_code='SCJL'`（手机端没有报工单号；
有报工单号时是 `WO_REPORT`），`source_line_key='SCJL#<scjl.id>'`。

## 3. 代码落点

- `backend/.../service/QcInspAutoService.java`（新，深模块）：判据 = 该工序累计已报工 ≥ 该道计划量；
  成型 → 首件 + 制程，组装 → 组装成品；幂等键 = 工单号 + 工单行号；计划量取数
  ①`wo_process_line.计划数量` ②`plang.pl_sl × bs_route.换算率` ③均为 0 时不设数量门禁。
- `ExternalReportAbsorbService`：每行吸收事务**提交后**调
  `ButtonService.generateInspFromReportRow`（避免与外层行锁互等）。
- `ButtonService.woInspGenerate`：报工审核路径改成同一份判定 + `saveDrafts`（只负责保存与占用链）。
