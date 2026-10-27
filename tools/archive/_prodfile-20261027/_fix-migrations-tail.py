import subprocess

p = 'tools/db-migrations.txt'

# 先确认工作区就是 HEAD 的字节(否则不写)
head = subprocess.run(['git', 'show', 'HEAD:tools/db-migrations.txt'], capture_output=True).stdout
cur = open(p, 'rb').read()
if cur != head:
    raise SystemExit('ABORT: working file != HEAD bytes, refuse to append')

# 原文件末尾是 LF(裸),追加时沿用同样的单 LF ——
# .gitattributes 对该文件设了 `-text`(禁用任何行尾转换),所以 git 存什么就是什么,
# 混用 CRLF 会造成整段 diff 假重写(55 行删除/55 行新增)。
add = '\n'.join([
    '',
    '# 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #3/#4):',
    '#   「产品管控类型:名称改为【产品管控等级】其内容引用产品信息表对应字段的内容」/',
    '#   「产品形态:其内容引用产品信息表对应字段的内容」——选 A = 真参照。',
    '#   RD_MOLD_PROC / RD_MOLD_FORMULA 的这两格由写死下拉改成参照 RD_PROD_INFO;',
    '#   纸面名走 alias(数据键 col_name 不动 ⇒ 历史单据照原值显示,不报错)。两账套都执行。',
    'migrate-mold-proc-ref-prodinfo-20261027.sql',
    '',
    '# 2026-10-27 用户口径(#5)「章节标准库·配料要求:支持多行同步填入文本框,多行填充时赋予序号」——',
    '#   纯前端改动,无迁移脚本:mold.batching 库本就存在(RD_MOLD_PROC.配料要求 data_type=标准库),',
    '#   只是还没有条目。用户 2026-10-27 明确「只补机制,库留空」⇒ 种子条目由工艺科在',
    '#   「⧉ 标准库维护」里自行录入,本批不替业务编造正文(编了就成了受控文书上的假数据)。',
    '#   改动位置:frontend/src/core/views/sectionLibText.js(多行带序号)+ RecordSheetPanels.applySectionLib。',
    '',
]).encode('utf-8')

with open(p, 'wb') as f:
    f.write(head + add)

d = open(p, 'rb').read()
print('appended:', len(add), 'bytes')
print('CRLF:', d.count(b'\r\n'), 'bareLF:', d.count(b'\n') - d.count(b'\r\n'))
