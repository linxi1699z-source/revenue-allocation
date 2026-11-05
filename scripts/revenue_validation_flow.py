"""Pre-generated posting-group validation and expiry settlement, latest rules."""


def configure(pages, texts, meta, notes, move, formulas):
    by_id={page.id:page for page in pages}
    checks=by_id['checks']
    checks.nodes={}; checks.edges=[]
    texts['checks']={
        'start':'每次执行分摊逻辑后\n预生成本组分摊记录，尚未写入',
        'batch_balance':'本组预生成分摊记录\n借记总额是否等于贷记总额？',
        'batch_alert':'本次不新增分摊记录\n飞书预警：{平台订单 ID}本次产生的分摊记录，借贷总额不相等。\n异常备注：借贷金额不相等。\n收入分摊状态设为「分摊异常」',
        'batch_pass':'本组借贷金额相等\n保留本组待写入记录，继续校验',
        'more_groups':'本次仍有未校验的记录组？',
        'next_group':'取下一组预生成分摊记录',
        'due':'权益过期时间 ≤ 收入分摊截止时间？',
        'not_due':'尚未到权益过期时间\n本次无需执行到期总额校验\n返回原业务流程写入记录、更新金额\n分摊状态按原业务流程处理',
        'calc':'计算到期总额校验的等式两侧金额',
        'balance':'平台应收账款净借记金额\n＋销售费用净借记金额\n是否等于\n主营业务收入净贷记金额\n＋合同负债净贷记金额？',
        'amountbad':'本次不新增分摊记录\n飞书预警：{平台订单 ID}分摊后，借贷总额不等。\n异常备注：完成分摊后，借贷总额不等于已确认收入。\n收入分摊状态设为「分摊异常」\n返回原业务流程处理校验失败',
        'passed':'到期总额校验通过\n允许写入记录并更新金额\n无异常后收入分摊状态设为「完成分摊」\n返回原业务流程执行',
        'end':'结束',
    }
    for node,row,col,kind in [
        ('start',0,0,'terminal'),('batch_balance',1,0,'decision'),('batch_alert',1,1,'error'),
        ('batch_pass',2,0,'process'),('more_groups',3,0,'decision'),('next_group',3,1,'process'),
        ('due',4,0,'decision'),('not_due',4,1,'process'),('calc',5,0,'process'),
        ('balance',6,0,'decision'),('amountbad',6,1,'error'),('passed',7,0,'process'),
        ('end',8,0,'terminal'),
    ]:
        checks.n(node,texts['checks'][node],row,col,kind)
    for source,target in [('start','batch_balance'),('batch_pass','more_groups'),
                          ('next_group','batch_balance'),('calc','balance'),('passed','end')]:
        checks.e(source,target)
    for source,target,label,side in [
        ('batch_balance','batch_pass','是',False),('batch_balance','batch_alert','否',True),
        ('more_groups','next_group','是',True),('more_groups','due','否',False),
        ('due','calc','是',False),('due','not_due','否',True),
        ('balance','passed','是',False),('balance','amountbad','否',True),
    ]:
        checks.e(source,target,label,side)
    move['checks']={}
    formulas['checks']={
        'calc':('计算到期总额校验金额',[
            ('等式左侧 · 平台应收账款与销售费用',[
                '平台应收账款借记总额', '－平台应收账款贷记总额',
                '＋销售费用借记总额', '－销售费用贷记总额']),
            ('等式右侧 · 主营业务收入与合同负债',[
                '主营业务收入贷记总额', '－主营业务收入借记总额',
                '＋合同负债贷记总额', '－合同负债借记总额']),
        ],''),
    }
    meta['checks']=('七、数据校验与分摊状态',
        '每次逻辑预生成记录后逐组校验借贷；权益过期时间不晚于收入分摊截止时间时，再校验到期总额，通过后才确认本次写入。',
        '本次确认的预生成记录与到期总额校验规则')
    notes['checks']=[
        '逐组校验：每次执行分摊逻辑后，分别校验每一组预生成记录的借记总额与贷记总额。平台应收账款与合同负债可组成一组；部分退款中的平台应收账款、合同负债与主营业务收入可组成一组。每组必须单独平衡，不能只校验所有组汇总后的净额。',
        '本组异常：不新增本次分摊记录；飞书预警「{平台订单 ID}本次产生的分摊记录，借贷总额不相等。」；异常备注「借贷金额不相等。」；收入分摊状态设为分摊异常。',
        '到期总额校验：当权益过期时间 ≤ 收入分摊截止时间时，校验平台应收账款（借记总额－贷记总额）＋销售费用（借记总额－贷记总额）＝主营业务收入（贷记总额－借记总额）＋合同负债（贷记总额－借记总额）。校验范围包含历史已写入记录和本次尚未写入记录，同一条记录只计算一次；不再单独判断剩余合同负债是否为0。',
        '到期异常：不新增本次分摊记录；飞书预警「{平台订单 ID}分摊后，借贷总额不等。」；异常备注「完成分摊后，借贷总额不等于已确认收入。」；所有场景收入分摊状态均设为分摊异常。无异常后写入记录、更新金额，再设为完成分摊。',
    ]

    # Missing dates must be generated before each posting group is checked.
    normal=by_id['normal']
    bottom={'update','done','more','finish','next','ongoing'}
    normal.edges=[e for e in normal.edges if e['s'] not in bottom and e['t'] not in bottom]
    texts['normal'].update({
        'bookA':'预生成初始平台应收账款与合同负债\n借记：平台应收账款，金额为初始平台应收账款\n贷记：合同负债，金额为初始平台应收账款\n明细统计时间为首次收入登记时间',
        'recognize':'预生成主营业务收入与合同负债记录\n贷记：主营业务收入，金额为以上公式计算金额\n借记：合同负债，金额为以上公式计算金额\n分摊明细统计时间为收入分摊截止时间',
        'tail_positive':'预生成非负的到期收入记录\n贷记：主营业务收入，金额为公式计算金额\n借记：合同负债，金额为公式计算金额\n分摊明细统计时间为收入分摊截止时间',
        'tail_negative':'预生成多确认到期收入的冲回记录\n借记：主营业务收入，金额为公式结果绝对值\n贷记：合同负债，金额为公式结果绝对值\n分摊明细统计时间为收入分摊截止时间',
        'future':'本分摊日尚未到权益生效时间\n不预生成本日主营业务收入与合同负债\n保留本次其他预生成记录，继续检查缺失日期',
        'more':'本次分摊范围内仍有缺失日期？',
        'next':'取下一个需要补充的分摊日\n预生成该日主营业务收入与合同负债记录',
        'group_balance':'进入「数据校验与分摊状态」\n执行逐组校验（第1项）\n每一组记录借记总额\n是否均等于贷记总额？',
        'group_bad':texts['checks']['batch_alert'],
        'update':'准备写入记录并更新金额\n计算更新后的已确认收入与剩余合同负债\n本次写入与金额更新待最终校验通过后保存',
        'done':'权益过期时间 ≤ 当前收入登记时间？',
        'finish':'进入「数据校验与分摊状态」\n执行到期总额校验（第2项）\n使用历史记录与本次预生成记录的合计金额',
        'completion_check':'到期总额校验是否通过？',
        'complete_save':'写入本次分摊记录\n更新已确认收入与剩余合同负债\n收入分摊状态设为「完成分摊」',
        'expiry_error':'本次不写入分摊记录，不保存本次金额更新\n飞书预警：{平台订单 ID}分摊后，借贷总额不等。\n异常备注：完成分摊后，借贷总额不等于已确认收入。\n收入分摊状态设为「分摊异常」',
        'ongoing':'写入本次分摊记录\n更新已确认收入与剩余合同负债\n收入分摊状态设为「分摊中」\n等待下一次每日收入分摊',
    })
    for node,row,col,kind in [
        ('group_balance',10,0,'decision'),('group_bad',10,1,'error'),
        ('completion_check',14,0,'decision'),('complete_save',15,0,'process'),
        ('expiry_error',14,1,'error'),
    ]:
        normal.n(node,texts['normal'][node],row,col,kind)
    for source,target in [('recognize','more'),('tail_positive','more'),('tail_negative','more'),
                          ('future','more'),('next','iterate'),('update','done'),
                          ('finish','completion_check')]:
        normal.e(source,target)
    for source,target,label,side in [
        ('more','next','是',True),('more','group_balance','否',False),
        ('group_balance','update','是',False),('group_balance','group_bad','否',True),
        ('done','finish','是',False),('done','ongoing','否',True),
        ('completion_check','complete_save','是',False),('completion_check','expiry_error','否',True),
    ]:
        normal.e(source,target,label,side)
    normal.nodes['finish']['kind']='sub'
    meta['normal']=('三、无退款收入分摊',
        '补齐缺失日期、逐组校验，再按到期条件校验总额；无异常后保存本次分摊记录与金额更新。',
        meta['normal'][2])
    move['normal'].update({'more':(9,0),'next':(9,1),'group_balance':(10,0),'group_bad':(10,1),
        'update':(11,0),'done':(12,0),'ongoing':(12,2),'finish':(13,0),
        'completion_check':(14,0),'expiry_error':(14,1),'complete_save':(15,0)})
    notes['normal']=[note for note in notes['normal'] if not note.startswith('完成条件：')]
    notes['normal'] += [
        '写入顺序：先补齐所有缺失日期的预生成记录，再逐组校验借贷金额，计算更新后的已确认收入与剩余合同负债。若需到期总额校验，本次记录与金额更新在校验通过后一起保存；异常时不保留本次写入或金额更新。',
        '流程三状态：单组借贷不等时设为分摊异常；权益过期时间 ≤ 当前收入登记时间时进入流程七第2项，到期总额校验通过才完成分摊，失败不写入本次记录并设为分摊异常。',
    ]

    # Callers commit amounts and set completion only after the shared checks pass.
    success='进入「数据校验与分摊状态」\n无异常后写入本次分摊记录\n更新已确认收入与剩余合同负债\n收入分摊状态设为「完成分摊」\n校验失败不写入本次记录，状态设为「分摊异常」'
    for page,nodes in {'sameday':['zeroaction','endneg','finish'],
                       'fullrefund':['update'],
                       'partial':['equal_finish','finished']}.items():
        for node in nodes:
            text=success
            if page=='sameday' and node=='finish':text+='\n分摊明细统计时间为首次收入登记时间'
            if page=='fullrefund':text+='\n分摊明细统计时间为退款登记时间'
            if page=='sameday' and node=='zeroaction':text+='\n净收入为0，无需金额分摊明细'
            texts[page][node]=text
    for page,nodes in {
        'sameday':['posA','negative','consume'],
        'partial':['equalbook','book','settle'],
        'fullrefund':['bookfee','afterdone'],
    }.items():
        for node in nodes:
            lines=texts[page][node].split('\n')
            lines[0]='预生成'+lines[0].removeprefix('生成')
            texts[page][node]='\n'.join(lines)
    texts['partial']['equalend']='汇总本次预生成记录\n计算更新后的已确认收入与剩余合同负债\n待流程七校验通过后保存'
    notes['partial']=[note for note in notes['partial'] if not note.startswith('收尾条件：')]
    notes['partial'].append('校验与写入：退款分录先预生成；完成节点先进入流程七，校验无异常后才写入记录、更新已确认收入与剩余合同负债并完成分摊。退款处理中的「权益状态为已过期（退款）」判断保持不变。收尾时间判断不再以剩余合同负债为0替代；流程七到期校验使用最新借贷等式。')
    notes['fullrefund'][0]='本笔退款明细使用退款登记时间统计。谷歌订单存在多笔退款时，按退款日期逐笔处理；每笔记录先预生成并进入流程七校验，通过后写入并更新已确认收入与剩余合同负债，再处理下一笔。'

    texts['overview']['check']='进入「数据校验与分摊状态」\n先逐组校验本次预生成记录的借贷金额\n权益到期时，再校验资产费用与收入负债净额\n无异常后写入记录、更新金额和分摊状态'
    texts['overview']['zero']='预置已确认收入为0、剩余合同负债为0\n记录首次收入登记时间与明细统计时间\n进入流程七，无异常后设置「完成分摊」'
    texts['reversal']['finish']=success
    texts['reversal']['status']='拟将收入分摊状态改为「分摊中」\n待流程七校验通过后生效'
    for node in ('first_update','update'):
        texts['reversal'][node]=texts['reversal'][node].replace('更新已确认收入与剩余合同负债','计算更新后的已确认收入与剩余合同负债\n待流程七通过后保存')
    notes['reversal']=[note.replace('设置完成分摊并进入流程七','先进入流程七，无异常后写入记录、更新金额并设置完成分摊') for note in notes['reversal']]

    # Reversal settlement: validate all posting groups before the cutoff-date gate.
    reversal=by_id['reversal']
    texts['reversal'].update({
        'group_balance':texts['normal']['group_balance'],
        'group_bad':texts['checks']['batch_alert'],
        'done':'权益过期时间 ≤ 收入分摊截止时间？',
        'ongoing':'逐组校验通过，尚未到权益过期时间\n写入本次分摊记录\n更新已确认收入与剩余合同负债\n收入分摊状态设为「分摊中」\n等待下一次收入分摊',
    })
    for node,row,col,kind in [('group_balance',15,0,'decision'),('group_bad',15,1,'error')]:
        reversal.n(node,texts['reversal'][node],row,col,kind)
    for edge in reversal.edges:
        if edge['s'] in ('first_update','update') and edge['t']=='done':
            edge['t']='group_balance'
    reversal.e('group_balance','done','是')
    reversal.e('group_balance','group_bad','否',True)
    move['reversal']={'group_balance':(15,0),'group_bad':(15,1),'done':(16,0),
                      'ongoing':(16,2),'finish':(17,0)}
    meta['reversal']=('八、退款撤销收入分摊',
        '退款撤销先预生成记录并逐组校验；到期后进入流程七，无异常才写入记录、更新金额并完成分摊。',
        meta['reversal'][2])
    for node,title in {
        'reverse':'按实际原退款记录预生成反向凭证',
        'first_post':'预生成退款撤销后首次收入记录',
        'positive':'预生成非负的主营业务收入记录',
        'negative':'预生成多确认主营业务收入的冲回记录',
    }.items():
        _,*body=texts['reversal'][node].split('\n')
        texts['reversal'][node]='\n'.join([title]+body)
    notes['reversal'][4]=notes['reversal'][4].replace('权益过期时间 ≤ 当前收入登记时间时',
                                                   '权益过期时间 ≤ 收入分摊截止时间时')
    notes['reversal'].append('收尾校验：本次反向凭证与收入分摊记录先预生成，每一组借贷金额都必须相等；有任一组不等时，不写入本次记录并设为分摊异常。逐组通过后，权益过期时间 ≤ 收入分摊截止时间时进入流程七，无异常后写入记录、更新已确认收入与剩余合同负债并完成分摊，否则不写入并设为分摊异常；未到期则写入通过逐组校验的记录，保持分摊中。收尾不再设置未处理分摊日判断与取下一日回环。')
