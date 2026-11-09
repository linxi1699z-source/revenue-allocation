"""Consistent visible terms shared by nodes, formula panels and annotations."""
import re


def wording(text):
    text = text.replace('首次登记时间', '订单首次收入登记时间')
    text = re.sub(r'(?<!订单)首次收入登记时间', '订单首次收入登记时间', text)
    text = re.sub(r'(?<!订单)首次收入登记日期', '订单首次收入登记日期', text)
    text = re.sub(r'(?<!分摊)截止时间', '收入分摊截止时间', text)
    text = re.sub(r'(?:本次|当前)收入分摊截止时间', '收入分摊截止时间', text)
    text = re.sub(r'(?<!首次)(?<!当前)收入登记时间', '当前收入登记时间', text)
    text = re.sub(r'(?:分摊记录|分摊明细|明细)?统计时间', '分摊明细统计时间', text)
    text = text.replace('分摊明细统计时间取', '分摊明细统计时间为')
    for old, new in [
        ('十五天', '15天'), ('末尾零', '末尾0'),
        ('大于或等于零', '≥ 0'), ('小于零', '小于0'),
        ('剩余合同负债为零', '剩余合同负债为 0'),
        ('小于或等于当前收入登记时间', '≤ 当前收入登记时间'),
        ('小于或等于收入分摊截止时间', '≤ 收入分摊截止时间'),
        ('大于或等于退款撤销时间', '≥ 退款撤销时间'),
        ('权益过期时间不晚于当前收入登记时间', '权益过期时间 ≤ 当前收入登记时间'),
    ]:
        text = text.replace(old, new)
    return text


def apply_wording(texts, meta, notes, formulas):
    for page_id, nodes in texts.items():
        texts[page_id] = {node_id: wording(text) for node_id, text in nodes.items()}
    for page_id, values in meta.items():
        meta[page_id] = tuple(wording(value) for value in values)
    for page_id, values in notes.items():
        notes[page_id] = [wording(value) for value in values]
    for nodes in formulas.values():
        for node_id, (title, groups, foot) in nodes.items():
            title = wording(title)
            if title in ('确定订单首次收入登记时间', '更新订单首次收入登记时间'):
                title = '确定订单首次收入登记时间'
            nodes[node_id] = (title, [
                ('时间选取 · 太平洋时间' if label == '时间选取' else wording(label),
                 [wording(line) for line in lines]) for label, lines in groups
            ], wording(foot))
