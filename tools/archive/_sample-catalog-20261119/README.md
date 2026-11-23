# `_sample-catalog-20261119` — 送样登记表「内部检测目录」复核 + 明细页签改名(2026-11-19)

本目录是本轮任务(子任务 A)的一次性产物留档;生产脚本在 `tools/` 根层。

## 结论一句话

新文件 `提供系统更新版2026.11.17(1).xls` 的「内部检测目录」sheet 与
`提供系统更新版2026.11.17.xls` 的 Sheet1 **逐格内容一致** ⇒ 目录数据没有第 3 代,
本轮只做**在册复核(幂等重放)+ 明细页签标题改名**。

## 本轮交付

| 文件 | 作用 |
|---|---|
| `gen-migration.mjs` | 生成器(复制 20261117 版改造):源文件默认 = 「(1) 版」,sheet 名优先 `内部检测目录`(缺则回退 `Sheet1`),输出 `tools/migrate-sample-catalog-rev-20261119.sql` |
| `tools/migrate-sample-catalog-rev-20261119.sql` | 目录复核/部署版(字段改名 + 译名 + 55 行逐行 upsert + 目录外旧项作废 + 自检 55 行);1146 行,55 个 `-- 序号 元素` 行块 |
| `tools/migrate-sample-reg-detail-tab-20261119.sql` | `yj_panel.config` 加 `"detailTabLabel":"内部检测目录"`(JSON_MODIFY 合并,保留 `uniqueKeys`)+ `yj_translation` 面板译名 + 自检 |
| `_ProbeDetailTabLabel.java` | 探针:直接调生产类 `PanelRegistry.PanelDef.detailTabLabel()`,10 个用例覆盖「有值 / 缺省 / 空串 / 非字符串 / 非法 JSON」⇒ **10/10 PASS**(不起服务、不重启 8090) |
| `_q_verify.sql` | 只读复核:在册 55 行 / `硬度` 作废 / `色度` 收费为空 / `外送部分` 存在 / 字段改名 / 译名 / 序号重复 |
| `_q_panel.sql` | 只读:面板 `config` 与 `yj_translation` 结构现状(改前探针) |
| `_q_schema_log.sql` | 只读:`yj_schema_log` 里两条脚本的记账行(证明两账套都已记账、后续 `sync` 不会重放) |

## 复跑命令(两账套,先正式后测试)

```bash
cd tools
export JAVA_HOME="C:/Users/vigna/.jdks/ms-25.0.4"   # 仓库 pom = java 25
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar DbSync.java run migrate-sample-catalog-rev-20261119.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar DbSync.java run migrate-sample-catalog-rev-20261119.sql
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar DbSync.java run migrate-sample-reg-detail-tab-20261119.sql
YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar DbSync.java run migrate-sample-reg-detail-tab-20261119.sql
```

只读复核(需 `YINJIA_SQL_PASS` 环境变量):

```bash
cd tools
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env \
  archive/_sample-catalog-20261119/_q_verify.sql
```

## 实测结果(2026-11-19)

- 两账套目录复核一致:**总 56 行 / 在册 55 / 已作废 1**(作废的正是被「总硬度」取代的旧项 `硬度`);
- `色度`:收费为空、测试方法为空(源表如此,待业务补价);
- `外送部分`:序号 54 在册,备注 `不能测的：外送部分据实需求际联系机构进行报价等信息`;
- `yj_field`:`col_name=内部检出限` 在 `SAMPLE_REG` / `INSP_COMMISSION` 两个面板的 `label` 都已是 `标准方法检出限`;
- `yj_panel(SAMPLE_REG).config` 两账套均为 `{"uniqueKeys":[["检测元素"]],"detailTabLabel":"内部检测目录"}`。
