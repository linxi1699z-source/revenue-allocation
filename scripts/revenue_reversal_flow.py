"""Latest signed expiry postings and Apple refund-reversal workflow."""


def configure(pages, texts, meta, notes, move, formulas, scope):
    overview = next(p for p in pages if p.id == 'overview')
    texts['overview'].update({
        'restore': '订单为苹果退款撤销订单？',
        'restore_same': '退款时间与退款撤销时间\n属于太平洋时间的同一天？',
        'reversal': '执行「退款撤销收入分摊」\n按实际原退款凭证反向记录\n重新预估收入，分情况确认及补充分摊',
    })
    overview.n('restore', texts['overview']['restore'], 6, 0, 'decision')
    overview.n('restore_same', texts['overview']['restore_same'], 6, 1, 'decision')
    overview.n('reversal', texts['overview']['reversal'], 6, 2, 'sub')
    overview.edges = [e for e in overview.edges if (e['s'], e['t']) != ('dates', 'refund')]
    overview.e('dates', 'restore')
    overview.e('restore', 'refund', '否')
    overview.e('restore', 'restore_same', '是', True)
    overview.e('restore_same', 'normal', '是')
    overview.e('restore_same', 'reversal', '否', True)
    overview.e('reversal', 'check')
    move['overview'].update({
        'restore': (6, 0), 'restore_same': (6, 1), 'reversal': (6, 2), 'refund': (7, 0), 'normal': (7, 1),
        'same': (8, 0), 'different': (8, 1), 'sameday': (9, 0), 'check': (10, 0), 'end': (11, 0),
    })

    # Expiry is checked before first recognition so it covers every expired order.
    normal = next(p for p in pages if p.id == 'normal')
    texts['normal'].update({
        'tail_sign': '本次计算的主营业务收入金额\n大于或等于零？',
        'tail_positive': '记录非负的到期收入金额\n贷记：主营业务收入，金额为公式计算金额\n借记：合同负债，金额为公式计算金额\n分摊明细统计时间为收入分摊截止时间',
        'tail_negative': '冲回多确认的到期收入\n借记：主营业务收入，金额为公式结果绝对值\n贷记：合同负债，金额为公式结果绝对值\n分摊明细统计时间为收入分摊截止时间',
    })
    for node_id, row, col, kind in [
        ('tail_sign', 7, 0, 'decision'), ('tail_positive', 8, 0, 'process'),
        ('tail_negative', 7, 2, 'process'),
    ]:
        normal.n(node_id, texts['normal'][node_id], row, col, kind)
    removed = {('active', 'firstR'), ('firstR', 'expired'), ('expired', 'daily'), ('tail', 'recognize')}
    normal.edges = [e for e in normal.edges if (e['s'], e['t']) not in removed]
    normal.e('active', 'expired', '是')
    normal.e('expired', 'firstR', '否', True)
    normal.e('firstR', 'daily', '否', True)
    normal.e('tail', 'tail_sign')
    normal.e('tail_sign', 'tail_positive', '是')
    normal.e('tail_sign', 'tail_negative', '否', True)
    normal.e('tail_positive', 'update')
    normal.e('tail_negative', 'update')
    move['normal'].update({
        'expired': (5, 0), 'firstR': (5, 1), 'tail': (6, 0),
        'firstvalue': (6, 1), 'recognize': (8, 1),
        'tail_sign': (7, 0), 'tail_positive': (8, 0), 'tail_negative': (7, 2),
    })
    notes['normal'][1] += ' 到期公式结果大于或等于零时贷记主营业务收入、借记合同负债；小于零时按结果绝对值借记主营业务收入、贷记合同负债。两种情况的明细统计时间均为收入分摊截止时间。'
    notes['normal'][2] = '首次确认边界：未到权益生效时间时不确认主营业务收入；已到权益过期时间时，优先按到期公式及金额正负分支处理。尚未到期的首次确认继续按首次收入登记时间计算。'

    # Same-day reversal returns to ordinary registration before changing its date.
    dates = next(p for p in pages if p.id == 'dates')
    dates.nodes = {}; dates.edges = []
    texts['dates'].update({
        'restore_same': '退款时间与退款撤销时间\n属于太平洋时间的同一天？',
        'restore_age': '收入分摊截止时间减退款撤销时间\n大于15天？',
        'restore_time': '更新订单首次收入登记时间\n取退款撤销时间（太平洋时间）',
        'restore_cut': '更新订单首次收入登记时间\n取当前收入分摊截止时间',
        'restoreaction': '进入「退款撤销收入分摊」\n根据原退款实际记录生成反向凭证\n状态改为分摊中，不从普通首次分摊重新开始',
    })
    for node_id, row, col, kind in [
        ('start', 0, 0, 'terminal'), ('restore', 1, 0, 'decision'),
        ('restore_same', 1, 1, 'decision'), ('restore_age', 2, 1, 'decision'),
        ('restore_cut', 3, 1, 'process'), ('restore_time', 2, 2, 'process'),
        ('restoreaction', 4, 2, 'sub'), ('long', 4, 0, 'decision'),
        ('fpay', 4, 1, 'process'), ('fcut', 5, 0, 'process'),
        ('refund', 6, 0, 'decision'), ('norefund', 6, 1, 'process'),
        ('late', 7, 0, 'decision'), ('gpay', 7, 1, 'process'),
        ('gcut', 8, 0, 'process'), ('downgrade', 9, 0, 'decision'),
        ('normalE', 9, 1, 'process'), ('newE', 10, 0, 'process'),
        ('range', 11, 0, 'process'), ('end', 12, 0, 'process'),
        ('complete', 13, 0, 'terminal'),
    ]:
        dates.n(node_id, texts['dates'][node_id], row, col, kind)
    for a, b in [('start', 'restore'), ('restore_time', 'restoreaction'),
                 ('restore_cut', 'restoreaction'), ('fpay', 'refund'), ('fcut', 'refund'),
                 ('norefund', 'downgrade'), ('gpay', 'downgrade'), ('gcut', 'downgrade'),
                 ('normalE', 'range'), ('newE', 'range'), ('range', 'end'), ('end', 'complete')]:
        dates.e(a, b)
    for a, b, label, side in [
        ('restore', 'long', '否', False), ('restore', 'restore_same', '是', True),
        ('restore_same', 'restore_age', '否', False), ('restore_same', 'long', '是', False),
        ('restore_age', 'restore_cut', '是', False), ('restore_age', 'restore_time', '否', True),
        ('long', 'fcut', '是', False), ('long', 'fpay', '否', True),
        ('refund', 'late', '是', False), ('refund', 'norefund', '否', True),
        ('late', 'gcut', '是', False), ('late', 'gpay', '否', True),
        ('downgrade', 'newE', '是', False), ('downgrade', 'normalE', '否', True),
    ]:
        dates.e(a, b, label, side)
    notes['dates'][1] = '特殊订单规则：谷歌被降级旧订单继续分摊，使用降级后新订单的权益过期时间。苹果退款撤销订单进入流程八；退款与撤销在太平洋时间同一天时，按普通无退款订单处理，沿用支付成功时间的登记规则。跨日退款撤销时，收入分摊截止时间减退款撤销时间大于15天，订单首次收入登记时间取收入分摊截止时间；否则取退款撤销时间（含恰好15天）。升级后新订单正常分摊，苹果被升级旧订单存在退款时间时按退款流程处理。'
    notes['dates'][0] = '普通订单' + notes['dates'][0]
    meta['dates'] = ('二、登记时间与特殊订单', '使用太平洋时间确定登记时间；苹果跨日退款撤销进入流程八，同日退款撤销按普通无退款订单处理。', '原文第19至20页及本次退款撤销规则')
    formulas['dates'].update({
        'restore_time': ('更新订单首次收入登记时间', [('时间选取 · 太平洋时间', ['订单首次收入登记时间取退款撤销时间'])], ''),
        'restore_cut': ('更新订单首次收入登记时间', [('时间选取 · 太平洋时间', ['订单首次收入登记时间取', '当前收入分摊截止时间'])], ''),
    })
    move['dates'] = {}  # This page now declares its complete new grid above.

    texts['reversal'] = {
        'start': '处理苹果退款撤销订单',
        'record': '记录订单退款撤销时间\n日期与时间比较统一使用太平洋时间',
        'same_day': '退款时间与退款撤销时间\n属于太平洋时间的同一天？',
        'ordinary': '进入「无退款收入分摊」\n按普通无退款、非退款撤销订单处理\n不执行本页的退款反向凭证与重新预估逻辑',
        'due': '退款撤销时间\n小于或等于当前收入分摊截止时间？',
        'wait': '尚未到退款撤销处理时间\n本次不新增退款撤销相关分摊记录\n等待后续截止时间满足条件',
        'age': '收入分摊截止时间减退款撤销时间\n大于15天？',
        'event_time': '更新订单首次收入登记时间\n取退款撤销时间（太平洋时间）',
        'cut_time': '更新订单首次收入登记时间\n取当前收入分摊截止时间',
        'status': '收入分摊状态改为「分摊中」',
        'reverse': '按实际原退款记录生成反向凭证\n借记：原退款凭证中的贷记科目，金额不变\n贷记：原退款凭证中的借记科目，金额不变\n科目不限于平台应收账款、合同负债和主营业务收入\n统计时间为订单首次收入登记时间',
        'estimate': '计算退款撤销后的每日预估收入',
        'first': '本次退款撤销后\n尚无主营业务收入分摊记录？',
        'first_amount': '计算退款撤销后首次确认的收入',
        'first_post': '记录退款撤销后首次收入\n贷记：主营业务收入，金额为首次计算金额\n借记：合同负债，金额为首次计算金额\n统计时间为订单首次收入登记时间',
        'first_update': '更新已确认收入与剩余合同负债\n当前收入登记时间取订单首次收入登记时间',
        'select_day': '按日期先后选择待分摊日\n逐日补充至收入分摊截止日期\n已生成明细的日期不重复分摊',
        'expired': '权益过期时间\n小于或等于当前收入登记时间？',
        'tail': '按到期公式计算本次主营业务收入',
        'daily': '权益尚未到期，确认当期收入',
        'sign': '本次计算的主营业务收入金额\n大于或等于零？',
        'positive': '记录非负的主营业务收入金额\n贷记：主营业务收入，金额为公式计算金额\n借记：合同负债，金额为公式计算金额\n统计时间为收入分摊截止时间',
        'negative': '冲回多确认的主营业务收入\n借记：主营业务收入，金额为公式结果绝对值\n贷记：合同负债，金额为公式结果绝对值\n统计时间为收入分摊截止时间',
        'update': '更新已确认收入与剩余合同负债',
        'done': '权益过期时间 ≤ 收入分摊截止时间？',
        'finish': '收入分摊状态设为「完成分摊」\n进入「数据校验与分摊状态」流程',
        'ongoing': '保持收入分摊状态「分摊中」\n执行「数据校验与分摊状态」的本次金额校验\n等待下一次收入分摊',
    }
    reversal = scope['Page']('reversal', '', '', '')
    for node_id, row, col, kind in [
        ('start', 0, 0, 'terminal'), ('record', 1, 0, 'process'),
        ('same_day', 2, 0, 'decision'), ('ordinary', 2, 1, 'sub'),
        ('due', 3, 0, 'decision'), ('wait', 3, 1, 'process'),
        ('age', 4, 0, 'decision'), ('cut_time', 5, 0, 'process'), ('event_time', 4, 1, 'process'),
        ('status', 6, 0, 'process'), ('reverse', 7, 0, 'process'), ('estimate', 8, 0, 'process'),
        ('first', 9, 0, 'decision'), ('select_day', 9, 1, 'process'),
        ('first_amount', 10, 0, 'process'), ('first_post', 11, 0, 'process'),
        ('first_update', 12, 0, 'process'), ('expired', 10, 1, 'decision'),
        ('tail', 11, 1, 'process'), ('daily', 10, 2, 'process'),
        ('sign', 12, 1, 'decision'), ('positive', 13, 1, 'process'), ('negative', 12, 2, 'process'),
        ('update', 14, 1, 'process'), ('done', 16, 0, 'decision'),
        ('finish', 17, 0, 'process'), ('ongoing', 16, 2, 'process'),
    ]:
        reversal.n(node_id, texts['reversal'][node_id], row, col, kind)
    for a, b in [('start', 'record'), ('record', 'same_day'), ('event_time', 'status'),
                 ('cut_time', 'status'), ('status', 'reverse'), ('reverse', 'estimate'),
                 ('estimate', 'first'), ('first_amount', 'first_post'),
                 ('first_post', 'first_update'), ('first_update', 'done'),
                 ('select_day', 'expired'), ('tail', 'sign'), ('daily', 'sign'),
                 ('positive', 'update'), ('negative', 'update'), ('update', 'done')]:
        reversal.e(a, b)
    for a, b, label, side in [
        ('same_day', 'due', '否', False), ('same_day', 'ordinary', '是', True),
        ('due', 'age', '是', False), ('due', 'wait', '否', True),
        ('age', 'cut_time', '是', False), ('age', 'event_time', '否', True),
        ('first', 'first_amount', '是', False), ('first', 'select_day', '否', True),
        ('expired', 'tail', '是', False), ('expired', 'daily', '否', True),
        ('sign', 'positive', '是', False), ('sign', 'negative', '否', True),
        ('done', 'finish', '是', False), ('done', 'ongoing', '否', True),
    ]:
        reversal.e(a, b, label, side)
    meta['reversal'] = ('八、退款撤销收入分摊', '苹果跨日退款撤销先按原退款实际科目与金额生成反向凭证，再重新预估收入并按日分摊；同日退款撤销按普通无退款流程处理。', '本次用户确认的退款撤销规则')
    notes['reversal'] = [
        '时间选取：先将相关时间转换为太平洋时间。收入分摊截止时间减退款撤销时间大于15天时，订单首次收入登记时间取收入分摊截止时间，否则取退款撤销时间（含恰好15天）；这里取实际指定时间，不额外改为日末。撤销时间晚于本次截止时间时等待后续处理。',
        '反向凭证：按原退款实际分摊记录逐条对应，科目与金额保持一致，借贷方向相反，不限定为三个科目。例如原记录为平台应收账款贷记、合同负债借记、主营业务收入借记，反向记录则分别为平台应收账款借记、合同负债贷记、主营业务收入贷记。反向凭证统计时间取订单首次收入登记时间，同一撤销事件不重复生成反向凭证。',
        '首次确认：以本次退款撤销后的收入分摊记录判断首次，不以历史原收入或退款反向凭证作为本次首次按日确认的依据。首次确认时主营业务收入贷记、合同负债借记。金额四舍五入保留三位小数，展示省略末尾零。',
        '补摊与统计时间：首次收入登记日期与截止日期不是同一天时，按太平洋日期逐日补齐该范围内尚未处理的收入及合同负债明细。首次收入明细及退款反向凭证统计时间取订单首次收入登记时间；非首次明细按本次要求取收入分摊截止时间。',
        '到期与金额方向：非首次分摊未到期时取每日预估收入，到期时按应收账款净额减已确认收入净额计算。计算结果非负时贷记主营业务收入、借记合同负债；为负时按绝对值借记主营业务收入、贷记合同负债。权益过期时间 ≤ 当前收入登记时间时，设置完成分摊并进入流程七；剩余合同负债为0不再作为独立的完成分摊条件。',
        '待明确的时间边界：每日预估收入公式的时间差统一换算为天数；权益过期时间不晚于退款撤销时间时分母非正，原说明未给出处理方式。首次登记时间晚于权益过期时间的首次计算是否截断，也需补充确认，不在本图擅自改写公式。',
    ]
    formulas['reversal'] = {
        'event_time': ('更新订单首次收入登记时间', [('时间选取 · 太平洋时间', ['订单首次收入登记时间取退款撤销时间'])], ''),
        'cut_time': ('更新订单首次收入登记时间', [('时间选取 · 太平洋时间', ['订单首次收入登记时间取', '当前收入分摊截止时间'])], ''),
        'estimate': ('计算退款撤销后的每日预估收入', [('计算公式 · 每日预估收入', ['每日预估收入＝{初始平台应收账款', '－（主营业务收入贷记总额', '－主营业务收入借记总额）}', '÷（权益过期时间－退款撤销时间）'])], '时间差统一换算为天数'),
        'first_amount': ('计算退款撤销后首次确认的收入', [('计算公式 · 首次确认金额', ['主营业务收入金额＝', '（订单首次收入登记时间－退款撤销时间）', '× 每日预估收入'])], '金额四舍五入保留三位小数，展示省略末尾零'),
        'tail': formulas['normal']['tail'],
        'daily': ('权益尚未到期，确认当期收入', [('计算公式 · 当期确认金额', ['本次主营业务收入＝每日预估收入'])], ''),
    }
