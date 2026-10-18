#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
_gen-emp-import.py — 从 GitHub 仓库里的职员工件生成 bs_emp 导入迁移脚本(2026-10-19)

用户口径:
  1) 「职员的信息从GitHub上导入进来」 —— 源 = db/emp-data-20261018/职员档案-20261018.xlsx
     (2026-10-18 由 tools/archive/_emp-export-20261018/_export-emp-xlsx.mjs 导出并推送到
      MyPanda-Hash/YINJIA 公开仓库,含 122 行金蝶真实职员 + 8 行 E001-E008 演示档)
  2) 「把本地的清理一遍」 —— 本地 bs_emp 现在只有 16 行演示数据(E001-E008 重复插了两遍),
     真实职员 122 行已不在本地。物理删除那 16 行。
  3) 用户二次确认:**排除演示档只导 122 行**;**打码的联系方式留空**(仓库公开,手机/证件号
     在源文件里已是 134****9309 / 1101**********0011,不能当业务值写进库)。

产出:tools/migrate-emp-import-20261019.sql
用法(仓库根):python tools/archive/_emp-import-20261019/_gen-emp-import.py
"""
import os
import sys

import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'db', 'emp-data-20261018', '职员档案-20261018.xlsx')
OUT = os.path.join(ROOT, 'tools', 'migrate-emp-import-20261019.sql')

# 打码列:用户口径「留空」—— 公开仓库里的值已是 1xx****xxxx,写进库只会污染联系方式
MASKED_COLS = ['证件号码', '办公电话', '手机', '邮箱', '微信']
# id 是 IDENTITY 不插;备用1..20 源表全空不插
SKIP_COLS = {'id', '备用1', '备用2', '备用3', '备用4', '备用5', '备用6', '备用7', '备用8',
             '备用9', '备用10', '备用11', '备用12', '备用13', '备用14', '备用15', '备用16',
             '备用17', '备用18', '备用19', '备用20'} | set(MASKED_COLS)
BOOL_COLS = {'停用'}          # bit 列:xlsx 里是 '是'/'否'
DEMO_PREFIX = 'E00'           # E001-E008 演示档


def q(v):
    """SQL 字面量:None→NULL,其余按 nvarchar 转义单引号"""
    if v is None:
        return 'NULL'
    s = str(v).strip()
    if s == '':
        return 'NULL'
    return "N'" + s.replace("'", "''") + "'"


def val(col, v):
    if col in BOOL_COLS:
        if v is None:
            return '0'
        s = str(v).strip()
        return '1' if s in ('是', 'true', 'True', '1', 'Y') else '0'
    return q(v)


def main():
    if not os.path.exists(SRC):
        print('[FAIL] 找不到源文件: ' + SRC)
        return 1
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb['全字段']
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    header = [str(h) for h in rows[0]]
    data = rows[1:]

    i_code = header.index('员工编码')
    real = [r for r in data if not str(r[i_code] or '').startswith(DEMO_PREFIX)]
    demo = [r for r in data if str(r[i_code] or '').startswith(DEMO_PREFIX)]
    print('源文件总行数 = %d(真实 %d / 演示 %d)' % (len(data), len(real), len(demo)))
    if len(real) != 122:
        print('[FAIL] 真实职员行数不是 122,源文件可能变了,先核对再生成')
        return 1

    cols = [h for h in header if h not in SKIP_COLS]
    print('写入列 %d 个: %s' % (len(cols), ' / '.join(cols)))

    # 空列体检:某列 122 行全空就不写(减少噪音)
    keep = []
    for c in cols:
        i = header.index(c)
        if any(r[i] is not None and str(r[i]).strip() != '' for r in real):
            keep.append(c)
        else:
            print('  [空列] 跳过: ' + c)
    cols = keep
    print('实际写入列 %d 个' % len(cols))

    idx = {c: header.index(c) for c in cols}
    lines = []
    lines.append('-- migrate-emp-import-20261019.sql — 职员档案:清理本地演示数据 + 从仓库导入真实职员(2026-10-19)')
    lines.append('--')
    lines.append('-- 【背景】本地 bs_emp 只剩 16 行 E001-E008 演示数据(同一批重复插了两遍),')
    lines.append('--   真实职员 122 行已不在本地;仓库 db/emp-data-20261018/职员档案-20261018.xlsx 有 130 行')
    lines.append('--   (122 真实 + 8 演示),由 tools/archive/_emp-export-20261018/_export-emp-xlsx.mjs 导出。')
    lines.append('--')
    lines.append('-- 【用户口径 2026-10-19】')
    lines.append('--   ① 「职员的信息从GitHub上导入进来,把本地的清理一遍」')
    lines.append('--   ② 排除演示档,只导 122 行真实职员(E001-E008 是演示残留,不重新灌回库)')
    lines.append('--   ③ 打码的联系方式留空 —— 该仓库是**公开仓库**,源文件里手机/证件号已脱敏为')
    lines.append('--      134****9309 / 1101**********0011,当业务值写进库只会污染联系方式:')
    lines.append('--      ' + ' / '.join(MASKED_COLS) + ' 一律 NULL,等拿到真实值再由业务补录。')
    lines.append('--')
    lines.append('-- 幂等:① 删除只命中 E001-E008 且断言 16 行;② 插入按 员工编码 NOT EXISTS 判重。')
    lines.append('-- 本脚本由 tools/archive/_emp-import-20261019/_gen-emp-import.py 生成,勿手改。')
    lines.append('')
    lines.append('SET NOCOUNT ON;')
    lines.append('')
    lines.append('/* ═══ 1. 守卫:先看现状,不满足预期就停手 ═══ */')
    lines.append('DECLARE @total int = (SELECT COUNT(1) FROM bs_emp);')
    lines.append("DECLARE @demo int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]');")
    lines.append("DECLARE @imported int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'ZY%');")
    lines.append("PRINT N'  现状: bs_emp 共 ' + CAST(@total AS nvarchar(10)) + N' 行,其中演示档 ' + CAST(@demo AS nvarchar(10)) + N' 行,ZY* ' + CAST(@imported AS nvarchar(10)) + N' 行';")
    lines.append('')
    lines.append('/* ═══ 2. 清理本地演示数据(只删 E001-E008,不碰其它行) ═══ */')
    lines.append('IF @imported > 0')
    lines.append('BEGIN')
    lines.append("    PRINT N'  [SKIP] 已存在 ZY* 导入数据,跳过清理(幂等重跑)';")
    lines.append('END')
    lines.append('ELSE IF @demo = 0')
    lines.append('BEGIN')
    lines.append("    PRINT N'  [SKIP] 没有 E001-E008 演示档可清';")
    lines.append('END')
    lines.append('ELSE IF @total <> @demo')
    lines.append('BEGIN')
    # RAISERROR 的消息参数位**不接受表达式**(写 @total - @demo 会报 Incorrect syntax near '-'),
    # 必须先算到变量再传(2026-10-19 实测踩到)
    lines.append('    DECLARE @extra int = @total - @demo;')
    lines.append("    RAISERROR(N'[FAIL] bs_emp 里除演示档外还有 %d 行,拒绝继续(避免误删真实数据)', 16, 1, @extra);")
    lines.append('    RETURN;')
    lines.append('END')
    lines.append('ELSE')
    lines.append('BEGIN')
    lines.append("    DELETE FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]';")
    lines.append('    DECLARE @del int = @@ROWCOUNT;')
    lines.append('    IF @del <> 16')
    lines.append('    BEGIN')
    lines.append("        RAISERROR(N'[FAIL] 期望删除 16 行演示档,实际 %d 行,已回滚', 16, 1, @del);")
    lines.append('        RETURN;')
    lines.append('    END')
    lines.append("    PRINT N'  已删除演示档 ' + CAST(@del AS nvarchar(10)) + N' 行';")
    lines.append('END')
    lines.append('')
    lines.append('/* ═══ 3. 导入 122 行真实职员(员工编码判重;联系方式留空) ═══ */')
    lines.append('DECLARE @ins int = 0;')
    lines.append('')
    collist = '(' + ', '.join('[' + c + ']' for c in cols) + ')'
    for r in real:
        vals = ', '.join(val(c, r[idx[c]]) for c in cols)
        code = q(r[idx['员工编码']])
        lines.append("IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = %s)" % code)
        lines.append('BEGIN')
        lines.append('    INSERT INTO bs_emp ' + collist)
        lines.append('    VALUES (' + vals + ');')
        lines.append('    SET @ins = @ins + 1;')
        lines.append('END')
    lines.append('')
    lines.append('/* ═══ 4. 自检 ═══ */')
    # ⚠ 别用「ZY* 行数 = 122」做断言:源数据里有 7 位职员的员工编码是**拼音缩写**
    #   (GD / HQS / LYZ / LZW / XQ / ZL / ZXL,分别是孙淼淼/黄淇森/练玉珍/李梓维/谢琴/张莉/邹新龙),
    #   只有 115 行以 ZY 开头。断言要落在「总行数 122 + 演示档 0 + 无打码值」上。
    lines.append('DECLARE @zy int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N\'ZY%\');')
    lines.append('DECLARE @totalNow int = (SELECT COUNT(1) FROM bs_emp);')
    lines.append("DECLARE @demoLeft int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]');")
    lines.append("DECLARE @maskLeft int = (SELECT COUNT(1) FROM bs_emp WHERE ISNULL(证件号码,'') LIKE N'%*%' OR ISNULL(办公电话,'') LIKE N'%*%' OR ISNULL(手机,'') LIKE N'%*%' OR ISNULL(邮箱,'') LIKE N'%*%' OR ISNULL(微信,'') LIKE N'%*%');")
    lines.append("PRINT N'  结果: 总行数 = ' + CAST(@totalNow AS nvarchar(10)) + N' (其中 ZY* ' + CAST(@zy AS nvarchar(10)) + N'), 演示档残留 = ' + CAST(@demoLeft AS nvarchar(10)) + N', 打码值残留 = ' + CAST(@maskLeft AS nvarchar(10)) + N', 本次插入 = ' + CAST(@ins AS nvarchar(10));")
    lines.append('IF @totalNow <> 122')
    lines.append('BEGIN')
    lines.append("    RAISERROR(N'[FAIL] bs_emp 应为 122 行,实际 %d', 16, 1, @totalNow);")
    lines.append('    RETURN;')
    lines.append('END')
    lines.append('IF @demoLeft > 0')
    lines.append('BEGIN')
    lines.append("    RAISERROR(N'[FAIL] 仍有 %d 行演示档', 16, 1, @demoLeft);")
    lines.append('    RETURN;')
    lines.append('END')
    lines.append('IF @maskLeft > 0')
    lines.append('BEGIN')
    lines.append("    RAISERROR(N'[FAIL] 仍有 %d 行联系方式是打码值', 16, 1, @maskLeft);")
    lines.append('    RETURN;')
    lines.append('END')
    lines.append("PRINT N'[OK] 职员档案导入完成:122 行真实职员,演示档 0,联系方式无打码值';")

    text = '\r\n'.join(lines) + '\r\n'
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print('已写出: %s (%d 行, %.1f KB)' % (OUT, len(lines), len(text.encode('utf-8')) / 1024.0))

    # 顺带打样本,便于人工核对
    for r in real[:2]:
        print('  样本: ' + ', '.join('%s=%s' % (c, val(c, r[idx[c]])) for c in cols if r[idx[c]] not in (None, ''))[:300])
    return 0


if __name__ == '__main__':
    sys.exit(main())
