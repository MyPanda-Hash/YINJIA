# 库存修复包 · 2026-10-21(「有单据、有流水,却查不到库存明细」)

> 现象(用户报障):采购入库单 `CGRK-20261011-03389`(折叠棉 `YJ-YCYX-055`,890 + 16 = **906 支**)
> 已审核、库存台账里也有两行,但《库存明细》里查不到;该面板还整表显示"共 0 条"。

---

## 一、原因(一句话 + 三条)

**货没丢,是"结存缓存"被月结清成了 0,而《库存明细》视图把 0 行隐藏了。**

| # | 原因 | 证据 |
|---|---|---|
| 1 | 2026-09 月结(10-19 15:02)把 `kucun` 重算成「截至 2026-10-01」 | `kucun` 与"≤9/30 流水净额"逐键 0 差异,10 月 1,359 行流水被踢出结存 |
| 2 | 同一方法的"孤儿行清零"判据带 `单据日期 < 期末`,把这批 10-11 的单当成换键残影 | 该行 `rkl=0 ckl=0 yl=0`,`asp_user2=orphan-purge:admin`,时间与月结同一秒 |
| 3 | 《库存明细》读 `v_stock_kucun`,视图 `HAVING SUM(yl)<>0` | 零行被隐藏 ⇒ 单据在、货看不到 |

波及面(修复前实测):`kucun` 零行 **434** 个,其中 **289** 个其实有货(合计 **349,496.10**)。

> 详细取证:`docs/development/库存状况异常-当前取证与提交影响-20261021.md` §2.2 / §七。
> 代码侧已于 2026-10-21 修好(`StockMonthCloseService` 两处:月结只重算结存到今天 + 孤儿清零不再按期末截断)。

---

## 二、包内容

| 文件 | 用途 |
|---|---|
| `migrate-kucun-recalc-today-20261021.sql` | **修复脚本**:按全部流水重算 `kucun` 到今天 + 清"任何日期都没流水"的残影。幂等、不删行 |
| `apply-db.bat` | **服务器上一键执行**:备份 → 跑脚本 → 打印自检数字(纯 ASCII,cmd 直接可跑) |
| `SHA256SUMS.txt` | 指纹 |

脚本只动 `kucun` 一张表(结存缓存),**不碰流水、不碰单据、不碰表结构**;流水才是库存真源。

---

## 三、路线 A(推荐):只修数据,2 分钟,不用停服务

服务器:`http://36.140.66.163:8090`,库 `HSDZ_MES`,应用目录 `C:\yinjia`,部署目录 `C:\yj-deploy`。

```cmd
:: ① 解压到 C:\yj-deploy\stockfix(没有就建)
:: ② 管理员 cmd 执行
cd /d C:\yj-deploy\stockfix
apply-db.bat HSDZ_MES
```

成功判据(控制台最后一段):

```
kucun_rows|1480
sum_yl|-341626.3260        ← 与"全部流水净额"一致
zero_rows|148              ← 修复前是 434
seed_item_YJ-YCYX-055|906  ← 就是用户那张单的量
RESULT: DONE for HSDZ_MES
```

脚本自己会先做 `BACKUP DATABASE`(存到 `C:\yinjia\backup\pre-kucun-recalc-<时间戳>.bak`),
**备份失败就直接中止**,不会动数据。

> ⚠ 这一步**不需要停 8090**:脚本是短事务,跑完刷新浏览器即可看到 906。
> 若还有测试库要一起修:`apply-db.bat HSDZ_MES_TEST`。

---

## 四、路线 B(可选):数据 + 代码(防止下次月结再犯)

路线 A 只修好"现在";服务器上的**旧 jar 仍会在下次月结重复这个动作**(把结存写回期末 +
按期末截断清零)。要根治,需要把本地已修好的 jar 换上去。

1. **本地**拷出**现役且已修**的 jar:

   ```
   backend\target\yinjia-mes-backend-0.1.0.jar      ← 2026-10-21 16:23 已含修复
   ```

   > ⚠ 这个包**不入库**(95 MB)。若服务器当前 jar 比本地旧很多,换包会连带带上其它未上线的改动 ——
   > 那种情况建议**只走路线 A**,代码修复等下次整包上线一起发。

2. **服务器**换包(先停后换,jar 被占用会导致拷贝失败/瘦 jar):

   ```cmd
   :: 备份现役 jar
   copy /y C:\yinjia\app.jar C:\yinjia\backup\app-before-stockfix-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%.jar
   :: 停服务(计划任务名以服务器实际为准;若是在黑窗口里 java -jar 跑的,直接关窗口)
   schtasks /end /tn YINJIA-MES
   taskkill /f /im java.exe
   :: 覆盖
   copy /y C:\yj-deploy\stockfix\app.jar C:\yinjia\app.jar
   certutil -hashfile C:\yinjia\app.jar SHA256
   :: 起来
   schtasks /run /tn YINJIA-MES
   ```

3. **验收**:浏览器 `http://localhost:8090` 能登录;`C:\yinjia\logs` 或窗口无 `ERROR`;
   库存明细能看到 906;下一次月结后**结存不再回退到期末**。

4. **回滚**:`copy /y C:\yinjia\backup\app-before-stockfix-*.jar C:\yinjia\app.jar` 再起服务。

---

## 五、4-B 没有 sqlcmd 时(SSMS 手工跑)

1. SSMS 连 `localhost`(Windows 身份验证)→ 打开 `migrate-kucun-recalc-today-20261021.sql`;
2. **先**另开窗口备份:`BACKUP DATABASE [HSDZ_MES] TO DISK = N'C:\yinjia\backup\pre-fix.bak' WITH FORMAT, INIT`;
3. 执行脚本 —— 结果区最后一段是自检,`① 结存 Σyl − 流水 Σ净额`、`② 有流水却仍是 0 的键数`、
   `③ yl ≠ rkl − ckl 的行数` **三项必须都是 0**;
4. 再执行一次也安全(幂等)。

---

## 六、回滚(连库)

```cmd
schtasks /end /tn YINJIA-MES & taskkill /f /im java.exe
sqlcmd -S localhost -E -Q "ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-kucun-recalc-<时间戳>.bak' WITH RECOVERY, REPLACE; ALTER DATABASE [HSDZ_MES] SET MULTI_USER;"
schtasks /run /tn YINJIA-MES
```

> 本地同一动作已跑过两账套并验证:零行 434 → 148、"应恢复仍为 0" = 0、四个面板一致 906。

---

## 七、这次修好之后还剩什么(与本包无关,需业务拍板)

| 遗留 | 影响 |
|---|---|
| **真实期初仍缺**(只有 31 行演示期初) | 406 组负结存里 385 组靠它才能救,补期初后 406 → 32 |
| 2026-10-18 金蝶同步进来的 **836 张单没流水** | 补上会让账再负约 120 万,要和补期初一起做 |
| 一张单据日期写成 **2027-09-01** 的销售出库单 | 让台账与结存恒差 2,481 |
| 启动自检"三键不一致 **821**"(= 月结结转行数) | 自检把结转行当入库算,属口径 bug;改一句 SQL 即可 |

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-10-21 | 建档:原因、一键脚本、路线 A/B、验收与回滚、遗留清单 |
