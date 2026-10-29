from pathlib import Path
import xml.etree.ElementTree as ET
import re
import zlib
import base64
from urllib.parse import quote, unquote
from revenue_formula_styles import FORMULAS, draw_formula, draw_formula_condition, draw_posting, posting_node, style_xml

# Reuse the existing chart definitions and renderer without running its old export.
source = Path(__file__).with_name('build_revenue_flowcharts.py').read_text()
scope = {'__file__': str(Path(__file__).resolve())}
exec(source[:source.index('def straight_layout():')], scope)
exec(source[source.index('def wrap('):source.index("mx=ET.Element('mxfile'")], scope)
pages = scope['PAGES']

texts = {
'overview': {
'start': '开始收入分摊',
'queue': '生成待分摊记录\n存在支付成功时间的订单，生成待分摊收入记录\n获取退款后，生成待分摊退款记录\n同一订单同一天的净退款额汇总为一条记录',
'script': '执行时间：北京时间每日00:00:00\n等待苹果销售汇总报表获取完成\n收入分摊截止时间：前两日的太平洋时间 23:59:59\n选择收入分摊状态为待分摊或分摊中的订单',
'eligible': '存在支付成功时间，且\n支付成功时间或退款时间\n≤ 收入分摊截止时间？',
'wait': '本次不参与分摊，等待下次执行\n已退款但缺少支付成功时间的订单：\n先将支付成功时间补充为退款时间，再重新判断',
'exclude': '订单属于无需金额分摊的类型？',
'zero': '已确认收入为 0\n剩余合同负债为 0\n记录首次收入登记时间与明细统计时间\n收入分摊状态设为「完成分摊」',
'dates': '确定首次收入登记时间、退款登记时间\n根据特殊订单规则确定权益过期时间\n具体见「登记时间与特殊订单」流程',
'refund': '订单存在退款时间？',
'normal': '执行「无退款收入分摊」\n先登记平台应收账款与合同负债\n权益生效后，按日确认主营业务收入',
'same': '支付成功时间与退款时间\n属于太平洋时间的同一天？',
'different': '执行「跨日退款分摊」\n先处理待分摊收入，再处理待分摊退款\n根据退款类型进入全额退款或部分退款流程',
'sameday': '执行「同日支付与退款分摊」\n收入与退款记录完整后，按净收入金额处理\n根据权益状态决定是否继续确认收入',
'check': '每次产生分摊记录，先校验本次借贷总额\n本次设置为完成分摊时，再执行两项完成校验\n具体见「数据校验与分摊状态」流程',
'end': '本次分摊结束；未完成订单等待下次执行',
},
'dates': {
'start': '确定本次收入分摊使用的登记时间',
'restore': '订单为苹果退款撤销订单？',
'restoreaction': '收入分摊状态改为「待分摊」\n从首次分摊开始重新进行收入分摊',
'long': '支付成功时间减订单创建时间\n大于15天，或\n收入分摊截止时间减支付成功时间\n大于15天？',
'fpay': '首次收入登记时间\n＝支付成功时间对应日期的日末\n本次按「超15天条件优先」组织分支\n原文条件重叠，需确认',
'fcut': '首次收入登记时间\n＝本次收入分摊截止时间',
'refund': '订单存在本次待分摊退款？',
'norefund': '本次无需确定退款登记时间\n继续处理收入分摊',
'late': '收入分摊截止时间减退款时间\n大于15天？',
'gpay': '退款登记时间\n＝退款时间对应日期的日末',
'gcut': '退款登记时间\n＝本次收入分摊截止时间',
'downgrade': '订单为谷歌被降级的旧订单？',
'normalE': '沿用订单对应的权益过期时间\n升级后新订单按正常订单分摊\n苹果被升级旧订单存在退款时间时，按退款流程处理',
'newE': '被降级旧订单继续分摊\n计算收入时，使用降级后新订单的权益过期时间\n降级后新订单本身属于无需金额分摊的类型',
'range': '确定需要补充的每日分摊明细\n首次收入登记日期与收入分摊截止日期不同：逐日补齐\n两者为同一天：只生成当天明细\n最多补充至权益过期日期',
'end': '按有无退款进入对应的收入分摊流程',
'complete': '结束',
},
'normal': {
'start': '处理无退款订单的收入分摊',
'firstA': '尚不存在平台应收账款分摊记录？',
'skipA': '沿用已存在的平台应收账款与合同负债记录\n继续计算并确认已使用权益对应的收入',
'bookA': '登记初始平台应收账款与合同负债\n借记：平台应收账款，金额为初始平台应收账款\n贷记：合同负债，金额为初始平台应收账款\n明细统计时间为首次收入登记时间',
'iterate': '按日期先后处理需要补充的分摊日\n每日预估收入＝初始平台应收账款\n÷（权益过期时间－权益生效时间）\n时间差统一换算为天数',
'active': '当前分摊日已到权益生效时间？',
'future': '暂不确认主营业务收入\n保留已登记的平台应收账款与合同负债\n等待权益生效后继续收入分摊',
'firstR': '尚不存在主营业务收入分摊记录？',
'expired': '权益过期时间\n≤ 当前收入登记时间？',
'firstvalue': '计算首次确认的主营业务收入\n主营业务收入金额＝\n（首次收入登记时间－权益生效时间）\n× 每日预估收入\n金额四舍五入，保留三位小数',
'tail': '按到期公式计算本次主营业务收入\n主营业务收入＝平台应收账款借记总和\n－平台应收账款贷记总和\n－（已分摊主营业务收入借记总和\n－已分摊主营业务收入贷记总和）',
'daily': '权益过期时间 > 收入登记时间\n本次主营业务收入＝每日预估收入',
'recognize': '增加主营业务收入与合同负债分摊记录\n贷记：主营业务收入，金额为以上公式计算金额\n借记：合同负债，金额为以上公式计算金额\n分摊明细统计时间取收入分摊截止时间',
'update': '更新已确认收入与剩余合同负债\n检查是否已补齐首次收入登记日至截止日期的明细\n补充明细只需生成至权益过期日期',
'done': '权益过期时间 ≤ 收入登记时间，或\n剩余合同负债为 0？',
'more': '本次分摊范围内仍有缺失日期？',
'finish': '收入分摊状态设为「完成分摊」\n执行完成分摊时的金额校验',
'next': '取下一个需要补充的分摊日\n继续生成主营业务收入与合同负债明细',
'ongoing': '收入分摊状态设为「分摊中」\n等待下一次每日收入分摊',
},
'sameday': {
'start': '支付与退款属于太平洋时间的同一天',
'complete': '同时存在待分摊收入记录\n和待分摊退款记录？',
'tries': '缺少完整记录已连续执行5次？\n当天执行也计为一次',
'zero': '净收入为 0？',
'err': '收入分摊状态设为「分摊异常」\n飞书预警并记录异常备注：\n订单无完整收入与退款记录，无法完成分摊',
'zeroaction': '无需生成金额分摊明细\n已确认收入为 0\n剩余合同负债为 0\n收入分摊状态设为「完成分摊」',
'positive': '净收入大于 0？',
'posA': '按退款后的净收入登记应收账款与负债\n借记：平台应收账款，金额为净收入\n贷记：合同负债，金额为净收入\n明细统计时间为首次收入登记时间',
'negative': '净收入小于 0，登记财务费用\n借记：财务费用，金额为净收入绝对值\n贷记：平台应收账款，金额为净收入绝对值\n明细统计时间为首次收入登记时间',
'endneg': '已确认收入为 0\n剩余合同负债为 0\n收入分摊状态设为「完成分摊」\n执行分摊明细校验',
'revoked': '权益状态为「已过期（退款）」？',
'consume': '一次确认退款后的净收入\n贷记：主营业务收入，金额为净收入\n借记：合同负债，金额为净收入',
'remain': '权益仍可使用，继续按日确认收入\n每日预估收入＝净收入\n÷（权益过期时间－权益生效时间）\n按「无退款收入分摊」中的每日确认流程处理',
'finish': '更新已确认收入与剩余合同负债\n明细统计时间为首次收入登记时间\n收入分摊状态设为「完成分摊」\n执行分摊明细校验',
'wait': '本次暂不参与分摊\n等待下一次执行，补齐收入与退款记录',
},
'fullrefund': {
'start': '支付成功日期与退款日期不是同一天',
'income': '先处理待分摊收入记录\n按「无退款收入分摊」完成必要的收入登记\n然后处理待分摊退款记录',
'Aexists': '已存在平台应收款记录\n且已存在主营业务收入记录？',
'tries': '缺少平台应收账款记录\n或主营业务收入记录\n已连续执行5次？',
'cut': '本笔退款时间\n≤ 收入分摊截止时间？',
'errmissing': '收入分摊状态设为「分摊异常」\n飞书预警并记录异常备注：\n订单无完成收入记录，无法完成分摊',
'full': '本笔退款为全额退款？',
'continue': '尚未到本笔退款处理时间\n按「无退款收入分摊」继续确认每日收入\n保留本笔待分摊退款，等待后续处理',
'wasdone': '退款前，订单已完成收入分摊？',
'partial': '进入「部分退款分摊」流程\n比较退款后剩余收入与已确认收入\n按比较结果冲回收入或合同负债',
'valid': '全额退款后的净收入\n小于或等于 0？',
'afterdone': '冲回已完成分摊的订单收入\n借记：主营业务收入，金额为已确认收入\n贷记：平台应收账款，金额为已确认收入\n明细统计时间为退款登记时间',
'reverse': '冲回已确认收入与剩余合同负债\n借记：合同负债，金额为剩余合同负债\n借记：主营业务收入，金额为已确认收入\n贷记：平台应收账款\n金额为净收入绝对值＋本笔净退款额',
'badN': '收入分摊状态设为「分摊异常」\n飞书预警并记录异常备注：\n订单全额退款后净收入大于0，无法完成分摊',
'fee': '全额退款后的净收入小于 0？',
'nofee': '净收入为 0\n无需计提财务费用',
'bookfee': '增加财务费用分摊明细\n借记：财务费用，金额为净收入绝对值\n与前面冲减平台应收账款的金额配平',
'update': '明细统计时间为退款登记时间\n更新已确认收入与剩余合同负债\n收入分摊状态设为「完成分摊」\n执行分摊明细校验',
'wait': '未满5次，等待收入分摊完成\n下次检查平台应收账款记录\n与主营业务收入记录是否齐全',
},
'partial': {
'start': '处理本笔部分退款的净退款额',
'equal': '退款后剩余收入\n等于已确认收入？',
'greater': '退款后剩余收入\n大于已确认收入？',
'equalbook': '冲销剩余合同负债\n贷记：平台应收账款，金额为本笔净退款额\n借记：合同负债，金额为剩余合同负债\n借记：主营业务收入，金额为 0\n明细统计时间为退款登记时间',
'ratio': '计算已履约比例\n已履约比例＝已确认收入\n÷ 初始平台应收账款 × 100%\n比例保留两位小数',
'equalend': '更新已确认收入与剩余合同负债\n剩余合同负债为0时，完成分摊\n执行分摊明细校验',
'calc': '按原文计算需要退回的金额（公式待确认）\n已确认收入退回金额＝已确认收入\n－本笔净退款额 × 已履约比例\n合同负债退回金额＝剩余合同负债\n－（退款后剩余收入－本笔净退款额 × 已履约比例）\n金额保留三位小数',
'book': '生成本笔退款分摊明细\n贷记：平台应收账款，金额为本笔净退款额\n借记：主营业务收入，金额为已确认收入退回金额\n借记：合同负债，金额为合同负债退回金额\n明细统计时间为退款登记时间',
'refresh': '更新已确认收入与剩余合同负债\n检查本次借记总额与贷记总额是否相等\n继续检查权益是否已结束',
'expired': '权益状态为「已过期（退款）」？',
'settle': '一次确认剩余尚未确认的主营业务收入\n金额＝平台应收账款借记总额\n－平台应收账款贷记总额－已确认收入\n贷记：主营业务收入；借记：合同负债\n两者金额相同，明细统计时间为退款登记时间',
'keep': '权益仍可使用，继续按日分摊\n每日预估收入＝净收入\n÷（权益过期时间－权益生效时间）\n按「无退款收入分摊」中的每日确认流程处理',
'finished': '更新已确认收入与剩余合同负债\n收入分摊状态设为「完成分摊」\n执行完成分摊时的金额校验',
'less': '退款后剩余收入小于已确认收入\n收入分摊状态设为「分摊异常」\n飞书预警并记录异常备注：\n部分退款后收入小于已确认收入',
},
'checks': {
'start': '每次产生分摊记录后\n或将订单状态设置为「完成分摊」后',
'batch_balance': '本次产生的分摊记录\n借记总额是否等于贷记总额？',
'batch_alert': '发送飞书预警\n本次产生的分摊记录，借贷总额不相等。',
'completion_event': '本次是否将订单状态\n设置为「完成分摊」？',
'skip_completion': '本次未设置为「完成分摊」\n本次无需执行完成分摊校验',
'zero': '完成分摊时\n剩余合同负债是否为0？',
'liability_alert': '发送飞书预警\n完成分摊后，剩余合同负债非0。',
'calc': '计算完成分摊校验金额\n完成分摊校验金额＝平台应收账款借记总额\n－平台应收账款贷记总额\n＋财务费用借记总额－财务费用贷记总额',
'balance': '完成分摊校验金额\n＝已确认收入？',
'amountbad': '发送飞书预警\n完成分摊后，借贷总额不等于已确认收入。',
'end': '结束',
}}

meta = {
'overview': ('一、收入分摊入口与场景分流','只展示「功能说明—收入分摊逻辑」：从待分摊记录开始，按订单与退款情况进入对应流程。','原文第17至19页、第26页'),
'dates': ('二、登记时间与特殊订单','所有日期均按太平洋时间处理；每日明细统计时间固定为对应日期的23:59:59。','原文第19至20页'),
'normal': ('三、无退款收入分摊','先登记平台应收账款与合同负债，权益生效后再逐日确认主营业务收入。','原文第20至22页'),
'sameday': ('四、同日支付与退款分摊','支付与退款为同一天时，必须同时具有收入与退款待分摊记录，才开始分摊。','原文第20至22页'),
'fullrefund': ('五、跨日退款与全额退款分摊','先处理待分摊收入，再处理退款；本页展示跨日退款入口与全额退款，部分退款另见对应页面。','原文第22至23页、第26页'),
'partial': ('六、部分退款分摊','退款后剩余收入取订单的净收入；与本笔退款处理前的已确认收入比较。','原文第23至25页'),
'checks': ('七、数据校验与分摊状态','先校验每次产生记录的借贷总额；本次设置为完成分摊时，再执行剩余合同负债与已确认收入两项校验。','本次确认的数据与完成分摊校验口径'),
}
notes = {
'overview': [
'待分摊记录规则：每个订单只有一条待分摊收入；退款按同一订单、同一退款日期汇总。排除已经分摊中或完成分摊的退款，按退款时间与退款金额识别重复数据。谷歌订单可有多条跨日退款记录；苹果订单只保留一条匹配后的退款记录。',
'无需金额分摊的类型：沙箱环境全部订单；生产环境中的免费试用订单、赠送权益订单、谷歌降级后新订单，以及「修改后订单号」指向的订单。此类订单的首次收入登记时间与明细统计时间均使用支付成功日期的日末。',
'执行时间：北京时间每日00:00:00。等待苹果销售汇总报表获取完成后进行收入分摊。已完成分摊的订单又发生退款时，需明确如何进入退款处理，避免被常规状态筛选排除。'],
'dates': [
'原文待确认：首次收入登记时间的两个条件均使用「或」，在一个时间差超过15天、另一个不超过15天时会同时成立。本图暂按「任一时间差超过15天时，使用收入分摊截止时间」组织分支；登记时间在后续是否保持不变也需明确。',
'特殊订单规则：谷歌被降级旧订单继续分摊，并使用降级后新订单的权益过期时间；苹果退款撤销订单从首次分摊重新开始，状态改为待分摊；升级后新订单正常分摊，苹果被升级旧订单存在退款时间时按退款流程处理。'],
'normal': [
'每日分摊规则：首次收入登记时间与收入分摊截止时间不是同一天时，补充每一天的收入与合同负债明细，最多补充至权益过期日期。本次分摊明细统计时间为收入分摊截止时间。金额四舍五入保留三位小数，展示时省略末尾的0。',
'公式说明：到期计算节点严格保留原文的借贷顺序。例如平台应收账款借记100、贷记0，已分摊主营业务收入借记0、贷记90时，原式为100－0－（0－90）＝190。此处仅提示原式的计算结果，不改写业务公式；该结果不等于按已确认收入90计算的剩余金额10。',
'首次确认边界需明确：首次收入登记时间早于权益生效时间、或晚于权益过期时间时，原文未写明截断方法。本图按照用户说明，在权益生效后才确认主营业务收入。'],
'sameday': [
'原文待确认：净收入小于0的段落，多出一条未指明科目的「贷记」；图中只列出原文明确的财务费用借记与平台应收账款贷记。',
'已确认规则：净收入大于0且权益已过期（退款）时，一次确认退款后的净收入；主营业务收入为贷记，合同负债为借记，两条分摊记录金额均为净收入。'],
'fullrefund': [
'本笔退款明细使用退款登记时间统计。谷歌订单存在多笔退款时，按退款日期逐笔处理；每笔处理后更新已确认收入与剩余合同负债，再处理下一笔。',
'原文待确认：已完成分摊后全额退款的原文，只规定按已确认收入冲回主营业务收入与平台应收账款，未覆盖净收入小于0产生财务费用、或先前多笔部分退款导致的金额差异。'],
'partial': [
'原文公式待确认：初始平台应收账款为100、已确认收入为20、剩余合同负债为80、本笔净退款额为10、退款后剩余收入为90时，已履约比例为20%。按原文公式，已确认收入退回金额为18，合同负债退回金额为负8，出现负的负债退回金额。图中保留原文，需确认后使用。',
'部分退款后仍可使用权益时，按原文以净收入除以权益总时长计算新的每日预估收入。多笔退款需要明确每笔净收入的对应时点，以及新预估收入从哪一天开始应用。'],
'checks': [
'记录校验：每次产生分摊记录时，都比较本次产生记录的借记总额与贷记总额；该项按本次记录汇总，不能用订单历史累计金额抵消本次差额。',
'完成校验：每一次将订单状态设置为「完成分摊」，都执行后续两项校验；本次未设置该状态时，本次记录校验后结束。覆盖所有收入与退款分摊场景。',
'执行顺序：先校验剩余合同负债是否为0；无论该项通过还是发送预警，都继续校验指定借贷净额是否等于已确认收入。两项均异常时，分别发送两条预警。',
'金额口径：指定借贷净额为平台应收账款借记总额减贷记总额，加财务费用借记总额减贷记总额。使用该订单的累计分摊金额与已确认收入比较。'],
}

# Remove the upstream acquisition step; it is outside the requested section.
overview=pages[0]
del overview.nodes['data']
overview.edges=[e for e in overview.edges if e['s']!='data' and e['t']!='data']
overview.e('start','queue')

# End the date-preparation subflow explicitly after handing control back to scene selection.
date_page=next(p for p in pages if p.id=='dates')
date_page.nodes['end']['kind']='process'
date_page.n('complete','结束',11,kind='terminal')
date_page.e('end','complete')

# Keep the final balance/state update in the partial-refund branch only.
partial_page=next(p for p in pages if p.id=='partial')
del partial_page.nodes['refresh']
partial_page.edges=[e for e in partial_page.edges if e['s']!='refresh']
for edge in partial_page.edges:
    if edge['t']=='refresh':edge['t']='expired'

# Every completion-status assignment triggers both checks, including after a first alert.
checks_page=next(p for p in pages if p.id=='checks')
checks_page.nodes={};checks_page.edges=[]
for node_id,row,col,kind in [
    ('start',0,0,'terminal'),('batch_balance',1,0,'decision'),('batch_alert',1,1,'error'),
    ('completion_event',2,0,'decision'),('skip_completion',2,1,'process'),
    ('zero',3,0,'decision'),('liability_alert',3,1,'error'),
    ('calc',4,0,'process'),('balance',5,0,'decision'),('amountbad',5,1,'error'),
    ('end',6,0,'terminal')]:
    checks_page.n(node_id,texts['checks'][node_id],row,col,kind)
for a,b in [('start','batch_balance'),('batch_alert','completion_event'),('liability_alert','calc'),('calc','balance')]:checks_page.e(a,b)
checks_page.e('batch_balance','completion_event','是')
checks_page.e('batch_balance','batch_alert','否',True)
checks_page.e('completion_event','zero','是')
checks_page.e('completion_event','skip_completion','否',True)
checks_page.e('zero','calc','是')
checks_page.e('zero','liability_alert','否',True)
checks_page.e('balance','end','是')
checks_page.e('balance','amountbad','否',True)

move={
'overview':{'queue':(1,0),'script':(2,0),'eligible':(3,0),'wait':(3,1),'exclude':(4,0),'zero':(4,1),'dates':(5,0),'refund':(6,0),'normal':(6,1),'same':(7,0),'different':(7,1),'sameday':(8,0),'check':(9,0),'end':(10,0)},
'normal':{'daily':(5,2),'ongoing':(10,2)},
'sameday':{'zero':(3,0),'zeroaction':(4,0),'positive':(3,1),'negative':(3,2),'endneg':(4,2),'remain':(5,2),'wait':(1,2)},
'fullrefund':{'cut':(4,0),'full':(5,0),'wasdone':(6,0),'valid':(7,0),'reverse':(8,0),'fee':(9,0),'nofee':(9,1),'bookfee':(10,0),'update':(11,0),'wait':(2,2)},
'partial':{'less':(1,2),'expired':(5,1),'settle':(6,1),'keep':(5,2),'finished':(7,1)}
}

flow_references={
    '「登记时间与特殊订单」':'二、「登记时间与特殊订单」',
    '「无退款收入分摊」':'三、「无退款收入分摊」',
    '「同日支付与退款分摊」':'四、「同日支付与退款分摊」',
    '「跨日退款分摊」':'五、「跨日退款与全额退款分摊」',
    '「部分退款分摊」':'六、「部分退款分摊」',
    '「数据校验与分摊状态」':'七、「数据校验与分摊状态」',
    '进入数据校验与分摊状态流程':'进入七、「数据校验与分摊状态」',
}

def add_flow_reference_numbers(text):
    for old,new in flow_references.items():
        text=text.replace(old,new)
    return text

for p in pages:
    p.title,p.subtitle,p.source=meta[p.id]
    ordinal,name=p.title.split('、',1)
    p.title=ordinal+'、「'+name+'」'
    p.notes=notes[p.id]
    if p.id!='checks':
        p.notes=p.notes+['数据校验：每次产生分摊记录，先校验本次借贷总额是否相等；每次将订单状态设置为「完成分摊」，再执行流程七中的两项完成校验；首项完成校验预警后仍继续第二项。']
    p.badges={}
    for node in p.nodes.values():
        assert node['id'] in texts[p.id], (p.id,node['id'])
        row=(node['y']-180)/180
        col=round((node['x']-(380-node['w'])/2-90)/570)
        row,col=move.get(p.id,{}).get(node['id'],(row,col))
        node['text']=add_flow_reference_numbers(texts[p.id][node['id']])
        node['w'],node['h']=(540,240) if node['kind']=='decision' else ((500,100) if node['kind']=='terminal' else (600,280))
        node['x']=70+800*col+(600-node['w'])/2
        node['y']=260+420*row-node['h']/2
        if node['id'] in FORMULAS.get(p.id,{}):
            node['formula']=FORMULAS[p.id][node['id']]
        if p.id=='checks' and node['id']=='balance':
            node['formula_condition']=True
    # No letter abbreviations, formula variables, coded references, or the old account term.
    visible=[p.title,p.subtitle,p.source]+p.notes+[n['text'] for n in p.nodes.values()]
    for text in visible:
        assert not re.search('[A-Za-z]',text),(p.id,text)
        # Preserve the user's latest exact wording for this two-record gate.
        assert '平台应收款' not in text or (p.id=='fullrefund' and text==texts['fullrefund']['Aexists']),(p.id,text)

# Every page has exactly one explicit ending, reached from all terminal branches.
for p in pages:
    final_id={'overview':'end','dates':'complete','checks':'end'}.get(p.id,'flow_end')
    if final_id not in p.nodes:
        col=1 if p.id in ('sameday','partial') else 0
        bottom=max(n['y']+n['h'] for n in p.nodes.values())
        p.nodes[final_id]=dict(id=final_id,text='结束',x=120+800*col,y=bottom+280,w=500,h=100,kind='terminal')
    else:
        p.nodes[final_id]['text']='结束'
    p.final_id=final_id
    sources={e['s'] for e in p.edges}
    for node in list(p.nodes.values()):
        if node['id']!=final_id and node['id'] not in sources:
            p.e(node['id'],final_id)
            p.edges[-1]['closing']=True

scope['LEGEND']='颜色说明：紫色为计算公式，蓝色为时间选取或统计时间，青绿色为借记分录，橙色为贷记分录。\n时间与金额口径：均按太平洋时间对应日期统计；每日明细统计时间为23:59:59。已确认收入与剩余合同负债在本次分摊完成后更新。'

def note_layout(p):
    """Keep every annotation in a fixed upper-right column, clear of flow nodes."""
    font=scope['ImageFont'].truetype(scope['FONT'],17)
    card_width=720
    contents=['备注与规则说明']+p.notes+[scope['LEGEND'],'来源：'+p.source]
    heights=[54]+[len(scope['wrap'](text,font,card_width-40))*26+34 for text in contents[1:]]
    top=180
    total_height=sum(heights)+14*(len(contents)-1)
    right=max(n['x']+n['w'] for n in p.nodes.values())
    x=right+180
    cards=[]
    for text,height in zip(contents,heights):
        cards.append(dict(text=text,x=x,y=top,w=card_width,h=height))
        top+=height+14
    for card in cards:
        assert not any(max(card['x'],n['x'])<min(card['x']+card['w'],n['x']+n['w']) and
                       max(card['y'],n['y'])<min(card['y']+card['h'],n['y']+n['h']) for n in p.nodes.values())
    return cards

scope['note_layout']=note_layout

# Preserve the same drawing system, but enlarge text and boxes for full Chinese terms.
shared=source[source.index('def wrap('):source.index("mx=ET.Element('mxfile'")]
shared=shared.replace("ImageFont.truetype(FONT,18)","ImageFont.truetype(FONT,20)")
shared=shared.replace("fontSize=17;fontColor", "fontSize=20;fontColor")
shared=shared.replace("    width=max(n['x']+n['w'] for n in p.nodes.values())+130", "    cards=note_layout(p)\n    width=max(max(n['x']+n['w'] for n in p.nodes.values()),max(card['x']+card['w'] for card in cards))+80")
start=shared.index("    y=max(n['y']+n['h'] for n in p.nodes.values())+85",shared.index('def emit_xml'))
end=shared.index('    return model,width,y+40',start)+len('    return model,width,y+40')
shared=shared[:start]+'''    for j,card in enumerate(cards):
        style='rounded=0;html=0;whiteSpace=wrap;align=left;verticalAlign=middle;spacing=18;fontSize=17;fontColor=#72552F;fillColor=#FFF9EE;strokeColor=#DBC7A4;'
        if j==0:style+='fontStyle=1;fillColor=#F4E9D6;fontSize=20;'
        cell(f'note{j}',card['text'],card['x'],card['y'],card['w'],card['h'],style)
    height=max(max(n['y']+n['h'] for n in p.nodes.values()),max(card['y']+card['h'] for card in cards))+70
    return model,width,height'''+shared[end:]
start=shared.index("    y=max(n['y']+n['h'] for n in p.nodes.values())+85",shared.index('def render'))
end=shared.index('    im.save(',start)
shared=shared[:start]+'''    for j,card in enumerate(note_layout(p)):
        x,y,w,h=card['x'],card['y'],card['w'],card['h']
        d.rectangle((x,y,x+w,y+h),fill='#F4E9D6' if j==0 else '#FFF9EE',outline='#DBC7A4',width=1)
        note_font=ImageFont.truetype(FONT,20) if j==0 else small
        for i,line in enumerate(wrap(card['text'],note_font,w-40)):
            d.text((x+20,y+17+i*26),line,font=note_font,fill='#72552F')
'''+shared[end:]
exec(shared,scope)

def continuous_route(p,e):
    """Keep original business targets; return through open row gaps and outer lanes."""
    a,b=p.nodes[e['s']],p.nodes[e['t']]
    ax,ay=a['x']+a['w']/2,a['y']+a['h']/2
    bx,by=b['x']+b['w']/2,b['y']+b['h']/2
    start=(ax,a['y']+a['h']); end=(bx,b['y'])
    e['ports']=(.5,1,.5,0)
    below=any(n['id'] not in (e['s'],e['t'],p.final_id) and n['y']>=a['y']+a['h']
              and max(a['x'],n['x'])<min(a['x']+a['w'],n['x']+n['w']) for n in p.nodes.values())
    if e.get('closing'):
        direct=[start,end]
        if ax==bx and not scope['crosses'](direct,list(p.nodes.values()),(e['s'],e['t'])):
            pts=direct
        else:
            lane=max(n['x']+n['w'] for n in p.nodes.values())+100
            if below:
                pts=[(a['x']+a['w'],ay),(lane,ay),(lane,end[1]-60),(bx,end[1]-60),end]
                e['ports']=(1,.5,.5,0)
            else:
                pts=[start,(ax,start[1]+40),(lane,start[1]+40),(lane,end[1]-60),(bx,end[1]-60),end]
    elif e['side']:
        pts=[(a['x']+a['w'],ay),(b['x'],by)]
        e['ports']=(1,.5,0,.5)
    elif ax==bx and end[1]>start[1]:
        pts=[start,end]
    elif below and end[1]>a['y']+a['h'] and a['kind']!='decision':
        # Return branches leave to the right if another box occupies the column below.
        lane=a['x']+a['w']+60
        pts=[(a['x']+a['w'],ay),(lane,ay),(lane,end[1]-60),(bx,end[1]-60),end]
        e['ports']=(1,.5,.5,0)
    elif p.id=='normal' and e['s']=='next':
        # The daily loop returns to the actual date iterator along the left margin.
        bottom=max(n['y']+n['h'] for n in p.nodes.values() if n['id']!=p.final_id)+60
        pts=[start,(ax,bottom),(25,bottom),(25,b['y']-60),(bx,b['y']-60),end]
    elif (p.id=='overview' and e['s'] in ('normal','different')) or (p.id=='fullrefund' and e['s']=='afterdone'):
        # Bypass later branch boxes; join the common next step in its upper gap.
        lane=1530
        pts=[(a['x']+a['w'],ay),(lane,ay),(lane,b['y']-60),(bx,b['y']-60),end]
        e['ports']=(1,.5,.5,0)
    elif p.id=='dates' and e['s']=='norefund':
        lane=1530
        pts=[(a['x']+a['w'],ay),(lane,ay),(lane,b['y']-60),(bx,b['y']-60),end]
        e['ports']=(1,.5,.5,0)
    else:
        gap=b['y']-60
        pts=[start,(ax,gap),(bx,gap),end]
    assert all(x[0]==y[0] or x[1]==y[1] for x,y in zip(pts,pts[1:])),(p.id,e)
    obstacles=list(p.nodes.values())+[dict(card,id='note'+str(i)) for i,card in enumerate(note_layout(p))]
    assert not scope['crosses'](pts,obstacles,(e['s'],e['t'])),(p.id,e,pts)
    return pts

scope['route']=continuous_route
# Explicit ports preserve intended joins when the editable diagram is opened.
shared=shared.replace("        ex,ey=(1,.5) if e['side'] and a['kind']=='decision' else (.5,1)",
                      "        ex,ey,entx,enty=e['ports']")
shared=shared.replace("        entx,enty=(0,.5) if len(pts)==2 and pts[0][1]==pts[1][1] else (.5,0)", "        # Entry port is supplied by the continuous route.")
shared=shared.replace('strokeWidth=1.6;endArrow','strokeWidth=1.8;jumpStyle=arc;jumpSize=8;endArrow')
# Reload the exporter and renderer while retaining the verified route function.
exec(shared[shared.index('def emit_xml'):],scope)
scope['draw_formula']=lambda d,n: draw_formula(d,n,scope)
scope['draw_formula_condition']=lambda d,n: draw_formula_condition(d,n,scope)
scope['draw_posting']=lambda d,n: draw_posting(d,n,scope)
scope['posting_node']=posting_node
render_code=shared[shared.index('def render'):]
render_code=render_code.replace("        x,y,w,h=n['x'],n['y'],n['w'],n['h'];fill,stroke=COLORS[n['kind']]", "        if 'formula' in n:\n            draw_formula(d,n)\n            continue\n        x,y,w,h=n['x'],n['y'],n['w'],n['h'];fill,stroke=COLORS[n['kind']]")
render_code=render_code.replace("        if 'formula' in n:", "        if n.get('formula_condition'):\n            draw_formula_condition(d,n)\n            continue\n        if 'formula' in n:")
render_code=render_code.replace("        x,y,w,h=n['x'],n['y'],n['w'],n['h'];fill,stroke=COLORS[n['kind']]", "        if posting_node(n):\n            draw_posting(d,n)\n            continue\n        x,y,w,h=n['x'],n['y'],n['w'],n['h'];fill,stroke=COLORS[n['kind']]")
exec(render_code,scope)

out=scope['OUT']
root=ET.Element('mxfile',host='app.diagrams.net',type='device',version='26.0.0')
images=[]
for p in pages:
    model,w,h=scope['emit_xml'](p)
    style_xml(model,p)
    ET.SubElement(root,'diagram',id=p.id,name=p.title).append(model)
    (out/(p.id+'.xml')).write_text(ET.tostring(model,encoding='unicode'))
    im=scope['render'](p,w,h)
    images.append(im)
    im.save(out/(f'{pages.index(p)+1:02}-'+p.id+'.png'))
    for e in p.edges:
        points=scope['route'](p,e)
        assert all(a[0]==b[0] or a[1]==b[1] for a,b in zip(points,points[1:]))
        assert not e['t'].startswith('continue_')
    for n in p.nodes.values():
        if n['kind']=='decision':
            exits=[e for e in p.edges if e['s']==n['id']]
            assert len(exits)==2 and {e['label'] for e in exits}=={'是','否'}
    assert [n['id'] for n in p.nodes.values() if n['text']=='结束']==[p.final_id]
    # No branch can silently stop at a process box; all nodes can reach this ending.
    assert {n['id'] for n in p.nodes.values() if not any(e['s']==n['id'] for e in p.edges)}=={p.final_id}
    reachable={p.final_id}
    while True:
        expanded=reachable|{e['s'] for e in p.edges if e['t'] in reachable}
        if expanded==reachable:break
        reachable=expanded
    assert reachable==set(p.nodes),(p.id,set(p.nodes)-reachable)
    for i,a in enumerate(p.nodes.values()):
        for b in list(p.nodes.values())[i+1:]:
            assert not(max(a['x'],b['x'])<min(a['x']+a['w'],b['x']+b['w']) and max(a['y'],b['y'])<min(a['y']+a['h'],b['y']+b['h'])),(p.id,a['id'],b['id'])
    print(p.title+'：实际节点连续连接、正交线不穿过节点、判断双分支、全中文，检查通过')

ET.indent(root)
for path in [out/'订阅收入分摊完整流程图.drawio',out/'收入分摊逻辑-中文流程图.drawio']:
    ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
compressed=ET.fromstring(ET.tostring(root))
for page in compressed.findall('diagram'):
    model=page.find('mxGraphModel')
    encoded=quote(ET.tostring(model,encoding='unicode'),safe="~()*!.'-").encode()
    compressor=zlib.compressobj(wbits=-15)
    packed=compressor.compress(encoded)+compressor.flush()
    page.remove(model);page.text=base64.b64encode(packed).decode()
    assert ET.fromstring(unquote(zlib.decompress(base64.b64decode(page.text),-15).decode())).tag=='mxGraphModel'
ET.ElementTree(compressed).write(out.parents[1]/'收入分摊流程图.drawio',encoding='utf-8',xml_declaration=True)

# A compact visual index for checking all pages; individual pages remain full resolution.
Image=scope['Image']
thumbs=[]
for im in images:
    thumb=im.copy();thumb.thumbnail((420,1200));thumbs.append(thumb)
rowheight=[max(t.height for t in thumbs[:4]),max(t.height for t in thumbs[4:])]
sheet=Image.new('RGB',(1680,sum(rowheight)+40),'#E7EDF3')
for i,thumb in enumerate(thumbs):sheet.paste(thumb,((i%4)*420,0 if i<4 else rowheight[0]+40))
sheet.save(out/'中文流程图总览.png')
(out/'阅读说明.txt').write_text('仅根据功能说明—收入分摊逻辑绘制。\n全部可见文字为中文完整名词，不使用字母变量或编码接续。\n平台应收款已统一为平台应收账款。\n\n'+'\n\n'.join(p.title+'\n'+'\n'.join(p.notes) for p in pages))
print(out/'收入分摊逻辑-中文流程图.drawio')

# Keep the published HTML viewer in sync whenever the diagrams are regenerated.
import runpy
runpy.run_path(str(Path(__file__).with_name('build_flowchart_web.py')),run_name='__main__')
