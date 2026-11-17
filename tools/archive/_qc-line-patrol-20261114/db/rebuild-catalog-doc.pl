#!/usr/bin/env perl
# rebuild-catalog-doc.pl — 按字节重建 docs/development/数据库表清单.md
#
# 为什么需要它(2026-11-14 踩坑):
#   该文档是**混合行尾**历史文件(LF/CRLF 混存),edit 类工具回写会把 EF-only 行统一成 CRLF,
#   于是 diff 里多出 2 行"只差行尾"的假改动(v3.92 行 + 它前面那个空行)。
#   本脚本取「HEAD 原字节」+「改好的 4 处内容」重组:未被改动过的行**逐字节保留**,
#   新插行的行尾跟随邻行(CRLF),因此 git diff 只剩真实的内容差异。
#
# 用法(仓库根目录):
#   git show HEAD:docs/development/数据库表清单.md > /tmp/base.md
#   perl tools/archive/_qc-line-patrol-20261114/db/rebuild-catalog-doc.pl /tmp/base.md /tmp/edited.md docs/development/数据库表清单.md
#   参数: <HEAD原文件> <含已改好的 4 处内容的文件> <输出路径>
#   /tmp/edited.md 取自一次"用普通编辑器改好"的副本,只用于取那 4 行的文本(行尾会被剥掉重接)。
use strict;
use warnings;

my ($base_f, $cur_f, $out_f) = @ARGV;
die "usage: $0 <base> <cur> <out>\n" unless defined $out_f;

sub slurp {
    my ($p) = @_;
    open my $fh, '<:raw', $p or die "open $p: $!";
    local $/;
    my $s = <$fh>;
    close $fh;
    return $s;
}

my $base = slurp($base_f);
my $cur  = slurp($cur_f);

# 从改好的副本里取 4 行文本(剥掉行尾),按其在副本中的行号定位
my @cl = split /(?<=\n)/, $cur;
my $count_line = $cl[239];   # line 240: > 共 3x 张
my $row_head   = $cl[276];   # line 277: qc_line_patrol_head 行
my $row_detail = $cl[277];   # line 278: qc_line_patrol_detail 行
my $row_v396   = $cl[625];   # line 626: v3.96 维护记录行
for my $x (\$count_line, \$row_head, \$row_detail, \$row_v396) {
    $$x =~ s/[\r\n]+$//;
    die "空行:预期取到内容行\n" if $$x eq '';
}
die "取到的不是巡线两表的行\n" unless $row_head =~ /qc_line_patrol_head/ && $row_detail =~ /qc_line_patrol_detail/;
die "取到的不是 v3.96 行\n" unless $row_v396 =~ /^\| v3\.96 \|/;

my @bl = split /(?<=\n)/, $base;   # 保留每行原始行尾
my @out;
my ($hit_count, $hit_row) = (0, 0);
for my $ln (@bl) {
    my ($body, $eol) = $ln =~ /^(.*?)(\r?\n)?$/s;
    $body = '' unless defined $body;
    $eol  = '' unless defined $eol;
    if ($body eq '> 共 30 张') {
        $eol = "\r\n" if $eol eq '';
        $ln = $count_line . $eol;
        $hit_count++;
    }
    push @out, $ln;
    if ($body =~ /^\| `qc_first_insp_detail` \|/) {
        push @out, $row_head . "\r\n", $row_detail . "\r\n";
        $hit_row++;
    }
}
die "未找到 共 30 张 行(hit=$hit_count)\n" unless $hit_count == 1;
die "未找到 qc_first_insp_detail 行(hit=$hit_row)\n" unless $hit_row == 1;

# 维护记录追加到末尾(base 末行已有 CRLF,故直接接一行)
my $tail = pop @out;
if ($tail eq '') { push @out, $row_v396 . "\r\n"; }
else {
    push @out, $tail;
    push @out, $row_v396 . "\r\n";
}

open my $o, '>:raw', $out_f or die "open $out_f: $!";
print $o @out;
close $o;
print "OK: ", scalar(@out), " 段 -> $out_f\n";
