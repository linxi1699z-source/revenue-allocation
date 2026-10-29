from pathlib import Path
import xml.etree.ElementTree as ET
import math
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'output/收入分摊流程图'
OUT.mkdir(parents=True, exist_ok=True)
FONT = '/System/Library/Fonts/STHeiti Light.ttc'
COLORS = {
    'process': ('#EFF6FF', '#6087BA'), 'decision': ('#FFF6DE', '#B68A35'),
    'terminal': ('#E5F3EE', '#42836D'), 'error': ('#FFF0EE', '#BF6B63'),
    'sub': ('#EEEBFA', '#8574AE'), 'note': ('#FFF9EE', '#C59A53'),
}
PAGES = []

class Page:
    def __init__(self, id, title, subtitle, source):
        self.id, self.title, self.subtitle, self.source = id, title, subtitle, source
        self.nodes, self.edges, self.notes = {}, [], []
        PAGES.append(self)
    def n(self, id, text, row, col=0, kind='process'):
        w,h = (320,140) if kind=='decision' else ((300,74) if kind=='terminal' else (380,116))
        x = 90 + col*570 + (380-w)/2
        y = 180 + row*180
        self.nodes[id] = dict(id=id,text=text,x=x,y=y,w=w,h=h,kind=kind)
        return id
    def e(self, s, t, label='', side=False, via=None):
        self.edges.append(dict(s=s,t=t,label=label,side=side,via=via))
    def note(self, text): self.notes.append(text)

p=Page('overview','01 订阅收入分摊总流程','先登记平台应收款与合同负债，再随权益履约确认收入；退款进入对应冲回分支。','PDF 第 17–19、26 页；输入补充依据第 3–15 页')
p.n('start','支付成功 / 退款 / 退款撤销事件',0,kind='terminal')
p.n('data','获取或匹配金额与权益信息\nGoogle：订单 API；Apple：销售报表\n输入 I、N、Q、S、E 及退款时间',1)
p.n('queue','生成待分摊记录\n收入：每单一条；退款：同单同日汇总\nGoogle 可跨日多笔；Apple 仅一笔',2)
p.n('script','北京时间每日 01:00 执行 [D0]\n先完成 Apple 报表获取\n记录截止 C：T-2 日 PT 23:59:59',3)
p.n('eligible','存在支付成功时间且\n事件时间 ≤ C？',4,kind='decision')
p.n('wait','本次不纳入，等待后续批次\n已退款但缺支付成功时间：\n按原文用退款时间补齐后重判',4,1)
p.n('exclude','属于无需金额分摊\n的订单范围？',5,kind='decision')
p.n('zero','Sandbox；或 Production 的免费试用、\n赠送、Google 降级新单、修改后订单\nR=L=0，记录日期，完成分摊',5,1)
p.n('dates','执行 02：登记日期与特殊订单预处理\n确定 F、G、权益 E 与本轮分摊范围\n金额冲突与待确认口径见各页注释',6,kind='sub')
p.n('refund','订单存在退款时间？',7,kind='decision')
p.n('normal','执行 03：无退款收入分摊\n金额已匹配后：初始登记与逐日确认\n尚未匹配则继续等待金额输入',7,1,kind='sub')
p.n('same','支付与退款为 PT 同日？',8,kind='decision')
p.n('different','执行 05：跨日退款入口\n先收入后退款；全额退款直接处理\n部分退款转 06',8,1,kind='sub')
p.n('sameday','执行 04：同日退款\n等待完整记录，再按 N 的正负分流',9,kind='sub')
p.n('check','执行 07：借贷、完整性与完成校验\n更新已确认收入 R、剩余合同负债 L\n设置分摊中 / 完成分摊 / 分摊异常',10,kind='sub')
p.n('end','本轮结束；未完成订单下次继续',11,kind='terminal')
for a,b in [('start','data'),('data','queue'),('queue','script'),('script','eligible')]:p.e(a,b)
p.e('eligible','exclude','是');p.e('eligible','wait','否',True)
p.e('exclude','dates','否');p.e('exclude','zero','是',True)
p.e('dates','refund');p.e('refund','same','是');p.e('refund','normal','否',True)
p.e('same','sameday','是');p.e('same','different','否',True)
p.e('sameday','check');p.e('normal','check',via=1120);p.e('different','check',via=1090)
p.e('check','end')
p.note('范围说明：PDF 中相关章节实际位于 5.4 下的「4.收入分摊逻辑」；「3.撤销权益」作为 Google 退款与权益结束时间的上游输入。金额获取仅表现为输入，未展开 Apple 报表匹配算法。')
p.note('事件入队不等于当时生成财务明细：PRD 的分摊明细由批次脚本产生，按 F / G 回记统计日期。已完成订单发生新退款时仍须处理退款；批次仅筛「待分摊/分摊中」与此存在口径缺口，见 05 页 D6。')

p=Page('dates','02 登记时间、补摊范围与特殊订单','时间统一转换为 America/Los_Angeles；每天明细统计时间固定为 PT 23:59:59。','PDF 第 14–19、27 页')
p.n('start','进入本轮待分摊订单',0,kind='terminal')
p.n('restore','Apple 退款撤销需重新分摊？',1,kind='decision')
p.n('restoreaction','清空退款/撤销时间，更新权益时间\n重新匹配收入，状态改为待分摊\n保留历史明细，新一轮从首次分摊开始',1,1)
p.n('long','支付-创建 >15天\n或 C-支付 >15天？ [D1]',2,kind='decision')
p.n('fpay','F = 支付成功日期日末\n本图按「超15天优先」分流\n原文两个 OR 条件重叠，需确认',2,1)
p.n('fcut','F = C\n原文：任一时间差超过15天\n使用本轮分摊截止日期',3)
p.n('refund','本轮有待分摊退款？',4,kind='decision')
p.n('norefund','无退款登记时间 G\n继续确定收入分摊区间',4,1)
p.n('late','C-退款时间 >15天？',5,kind='decision')
p.n('gpay','G = 退款日期日末',5,1)
p.n('gcut','G = C',6)
p.n('downgrade','Google 被降级旧订单？',7,kind='decision')
p.n('normalE','沿用订单当前权益 E\n升级新单按正常订单处理\nApple 被升级旧单有退款则走退款分支',7,1)
p.n('newE','旧订单继续分摊\n计算时 E 使用降级后新单的过期时间\n降级新单本身走 01 的零金额分支',8)
p.n('range','确定逐日明细范围\n首次：F 至 min(C, 权益结束日)\n后续：从缺失的下一日继续',9)
p.n('end','返回 01，按退款场景分流',10,kind='terminal')
p.e('start','restore');p.e('restore','long','否');p.e('restore','restoreaction','是',True);p.e('restoreaction','long',via=1100)
p.e('long','fcut','是');p.e('long','fpay','否',True);p.e('fpay','refund',via=1070);p.e('fcut','refund')
p.e('refund','late','是');p.e('refund','norefund','否',True);p.e('norefund','downgrade',via=1130)
p.e('late','gcut','是');p.e('late','gpay','否',True);p.e('gpay','downgrade',via=1100);p.e('gcut','downgrade')
p.e('downgrade','newE','是');p.e('downgrade','normalE','否',True);p.e('newE','range');p.e('normalE','range',via=1070);p.e('range','end')
p.note('D0（P18/26）：执行时间出现 01:00 与 00:00 两种表述。本图按 P18「每日1点、先获取报表后分摊」展示。T-2 沿用 PRD 示例；生产配置应明确 T 所属日历。')
p.note('D1（P19）：F 的两个条件均使用「或」，在一项大于15天而另一项不超过15天时同时成立；「首次登记后其他情况都会变更」也有歧义。本图以超15天条件优先组织分支，F 是否后续锁定需确认。')
p.note('Apple 退款撤销例外（P14–15）：新过期时间与原时间相同，直接已过期且无需再次分摊；仅延长后进入上面的重新分摊路径。本页判断指已经满足重分摊条件的事件。')
p.note('历史上线初始化（P27）：F=支付时间，G=退款时间；原文指定从 2026-10-26 PT 23:59:59 开始补每日明细。退款且撤销权益使用变更后的 E；该起算日仅属于原 PRD 上线口径。')

p=Page('normal','03 无退款：初始登记与逐日收入确认','复用范围：无退款订单、退款尚未到本轮截止的订单，以及退款后仍保留权益的订单。','PDF 第 20–22、25–26 页；权益生效门槛依据用户说明')
p.n('start','进入收入分摊子流程',0,kind='terminal')
p.n('firstA','本轮初始平台应收款\n尚未登记？',1,kind='decision')
p.n('skipA','复用既有初始应收与负债记录\nApple 退款撤销重分摊按新一轮处理',1,1)
p.n('bookA','登记初始应收与负债\n借：平台应收款 I\n贷：合同负债 I；统计时间 F',2)
p.n('iterate','按时间顺序取一个待补分摊日 t\n普通 d=I/(E-S)，退款后 d=N/(E-S)\n所有时长先统一单位',3)
p.n('active','该日已到权益生效 S？',4,kind='decision')
p.n('future','仅保留平台应收与合同负债\n暂不确认主营业务收入\n等待权益生效后继续',4,1)
p.n('firstR','本轮尚无主营业务\n收入分摊记录？',5,kind='decision')
p.n('expired','本日 t ≥ 权益过期 E？',5,1,kind='decision')
p.n('firstvalue','首次确认金额 [D7]\nx=(F-S)×d；四舍五入至3位\n累计确认至首次登记日的履约收入',6)
p.n('tail','到期确认剩余尾差 [D2]\n原文：x=A-(主营借总-主营贷总)\n建议口径 x=A-R，须确认后使用',6,1)
p.n('daily','未到期：x=d\n确认本日预估收入',6,2)
p.n('recognize','生成等额收入与负债分摊明细\n借：合同负债 x；贷：主营业务收入 x\n统计时间=当前分摊日 t 的日末',8)
p.n('update','更新 R、L（公式见 07）\n确认未遗漏 F 至截止日的每日记录\n补摊最长截至权益结束日',9)
p.n('done','权益已过期或 L=0？',10,kind='decision')
p.n('more','截止范围内仍有缺失日？',10,1,kind='decision')
p.n('finish','状态：完成分摊\n转 07 进行完成金额校验',11)
p.n('next','取下一分摊日\n继续逐日生成收入与负债明细',11,1)
p.n('ongoing','状态：分摊中\n转 07，等待下一次脚本',11,2)
p.e('start','firstA');p.e('firstA','bookA','是');p.e('firstA','skipA','否',True);p.e('skipA','iterate',via=1100);p.e('bookA','iterate')
p.e('iterate','active');p.e('active','firstR','是');p.e('active','future','否',True)
p.e('firstR','firstvalue','是');p.e('firstR','expired','否',True);p.e('expired','tail','是');p.e('expired','daily','否',True,via=1130)
p.e('firstvalue','recognize');p.e('tail','recognize',via=1170);p.e('daily','recognize',via=1100)
p.e('recognize','update');p.e('update','done');p.e('done','finish','是');p.e('done','more','否',True)
p.e('more','next','是');p.e('more','ongoing','否',True,via=1160);p.e('next','iterate',via=1210)
p.note('D2（P21）：原文到期尾差公式减去「主营借总-主营贷总」，与 R=主营贷总-主营借总相反。例如 A=100、R=90，原式结果190；按剩余应确认额应为10。本图同时保留原式与待确认建议，不将建议当作已确认规则。')
p.note('D7（P20–22）：原文首次 x=(F-S)×d 未说明负值、F晚于E或首日已到期的截断处理。主线按用户要求加权益生效门槛；首次超过权益末日、日/秒换算、跨夏令时与尾差精度均需明确，避免超额确认。')
p.note('补摊统计日期按每个补充日记录；日常当期明细为 C。每笔 x 保留3位小数，展示去除末尾0。未到权益生效时只登记应收与负债，不因尚未确认收入而直接判为数据缺失。')

p=Page('sameday','04 同日支付与退款：净额登记','「同日」按支付成功日期与退款日期的太平洋时间判断。','PDF 第 20–22 页')
p.n('start','支付与退款属于 PT 同日',0,kind='terminal')
p.n('complete','同时具备待分摊收入\n和待分摊退款？',1,kind='decision')
p.n('tries','连续执行已达5次？\n当天首次执行计为第1次',1,1,kind='decision')
p.n('zero','净收入 N=0？',2,kind='decision')
p.n('err','飞书预警 + 状态：分摊异常\n备注：订单无完整收入与退款记录，\n无法完成分摊',2,1,kind='error')
p.n('zeroaction','不生成任何金额分摊明细\nR=0，L=0，状态：完成分摊\n转 07',3)
p.n('positive','净收入 N>0？',3,1,kind='decision')
p.n('posA','按退款后净额登记\n借：平台应收款 N；贷：合同负债 N\n统计时间=F',4,1)
p.n('negative','N<0：登记财务费用 [D3]\n借：财务费用 |N|\n贷：平台应收款 |N|；统计时间=F',4,2)
p.n('endneg','R=0、L=0，完成分摊\n转 07 校验',5,2)
p.n('revoked','权益状态为已过期(退款)？',5,1,kind='decision')
p.n('consume','一次确认净额剩余收入 [D3]\n贷：主营业务收入 N\n借：合同负债 N（待确认建议）',6,1)
p.n('remain','权益仍可使用\nd=N/(E-S)\n复用 03 的生效门槛与逐日确认',6,2)
p.n('finish','更新 R、L；完成分摊\n统计时间=F；转 07',7,1)
p.n('wait','记录不完整，本轮暂不分摊\n等待下一次脚本补齐数据',3,2)
p.e('start','complete');p.e('complete','zero','是');p.e('complete','tries','否',True)
p.e('tries','err','是');p.e('tries','wait','否',True)
p.e('zero','zeroaction','是');p.e('zero','positive','否',True)
p.e('positive','posA','是');p.e('positive','negative','否',True,via=1390)
p.e('negative','endneg');p.e('posA','revoked');p.e('revoked','consume','是');p.e('revoked','remain','否',True,via=1430);p.e('consume','finish')
p.note('D3（P20–21）：同日N<0段在借财务费用、贷平台应收后，多出一条未写科目的「贷记」，本图不猜测该科目。同日N>0且权益已过期(退款)段将收入与合同负债都写成贷记；与「借贷必相等」冲突。本图明确将合同负债借记列为待确认建议。')
p.note('本分支只在收入与退款待分摊记录完整后开始；不使用先登记初始金额再全额冲回的跨日路径。N≤0完成分摊；N>0按权益状态决定一次确认或继续逐日分摊。')

p=Page('fullrefund','05 跨日退款：先收入后退款与全额冲回','按退款日期依次处理；退款时间超过本轮截止时，先继续确认收入。','PDF 第 22–23、26 页')
p.n('start','支付与退款不属于 PT 同日',0,kind='terminal')
p.n('income','先处理符合本轮日期的收入记录\n初始登记、必要逐日确认复用 03\n随后处理本轮待分摊退款',1,kind='sub')
p.n('Aexists','存在平台应收款分摊记录？',2,kind='decision')
p.n('tries','缺失已连续5次？',2,1,kind='decision')
p.n('cut','本笔退款时间 ≤ C？',3,kind='decision')
p.n('errmissing','状态：分摊异常 + 飞书预警\n备注：订单无完成收入记录，\n无法完成分摊',3,1,kind='error')
p.n('full','本笔是全额退款？',4,kind='decision')
p.n('continue','尚未到退款处理时间\n按 03 继续每日收入确认\n本次保留退款，后续再处理',4,1)
p.n('wasdone','退款前已完成收入分摊？ [D6]',5,kind='decision')
p.n('partial','进入 06：部分退款\n按退款后 N 与已确认 R 比较',5,1,kind='sub')
p.n('valid','退款后净收入 N ≤ 0？',6,kind='decision')
p.n('afterdone','已完成后的全额退款 [D5]\n借：主营业务收入 R\n贷：平台应收款 R',6,1)
p.n('reverse','冲回未结束订单的全部收入与负债\n借：合同负债 L；借：主营业务收入 R\n贷：平台应收款 |N|+Q',7)
p.n('badN','状态：分摊异常 + 飞书预警\n备注：订单全额退款后净收入>0，\n无法完成分摊',7,1,kind='error')
p.n('fee','净收入 N<0？',8,kind='decision')
p.n('nofee','N=0：不计提财务费用',8,1)
p.n('bookfee','增加财务费用\n借：财务费用 |N|\n与上方应收贷记形成平衡',9)
p.n('update','本笔退款明细统计时间=G\n更新 R、L；状态：完成分摊\n转 07 校验',10)
p.n('wait','未满5次：等待收入分摊\n下一次先检查初始应收记录',3,2)
p.e('start','income');p.e('income','Aexists');p.e('Aexists','cut','是');p.e('Aexists','tries','否',True)
p.e('tries','errmissing','是');p.e('tries','wait','否',True)
p.e('cut','full','是');p.e('cut','continue','否',True)
p.e('full','wasdone','是');p.e('full','partial','否',True)
p.e('wasdone','valid','否');p.e('wasdone','afterdone','是',True)
p.e('valid','reverse','是');p.e('valid','badN','否',True)
p.e('reverse','fee');p.e('fee','bookfee','是');p.e('fee','nofee','否',True)
p.e('bookfee','update');p.e('nofee','update',via=1100);p.e('afterdone','update',via=1390)
p.note('D5（P23）：已完成分摊后全额退款的原文仅为「借主营R、贷应收R」，没有N<0时的费用分支，也没有多次部分退款后的金额差异处理。图中保留原文；负净收入或退款额不等于R的场景需补充口径。')
p.note('D6（P18/23/26）：批次筛选仅包含待分摊/分摊中，但又要求处理已完成订单退款。需确认新退款到达后是否重置订单状态，或独立扫描退款待分摊记录。本图显式保留「退款前已完成」判断，不能被普通完成状态过滤掉。')
p.note('同单多笔 Google 退款按日期逐条执行；每笔处理后刷新 R、L，再处理下一笔。Q 表示本条同日汇总净退款额，不应重复使用历史累计净退款额。')

p=Page('partial','06 跨日部分退款：冲回与剩余权益分摊','输入：已完成初始应收登记、本笔退款时间已进入截止范围、退款类型为部分退款。','PDF 第 23–25 页')
p.n('start','进入部分退款；取本笔 Q',0,kind='terminal')
p.n('equal','退款后净收入 N = R？',1,kind='decision')
p.n('greater','退款后净收入 N > R？',1,1,kind='decision')
p.n('equalbook','N=R：冲销剩余合同负债\n贷：平台应收款 Q；借：合同负债 L\n借：主营业务收入 0；统计时间=G',2)
p.n('ratio','计算已履约比例 p=R/I\n按百分比保留两位小数\n金额计算保留3位小数',2,1)
p.n('equalend','更新 R、L\n若 L=0 则完成，转 07 校验',3)
p.n('calc','按原文计算退回额 [D4]\n收入退回 X=R-Q×p\n负债退回 Y=L-(N-Q×p)',3,1)
p.n('book','生成退款分摊明细\n贷：平台应收款 Q\n借：主营业务收入 X；借：合同负债 Y',4,1)
p.n('refresh','统计时间=G\n刷新 R、L 后，检查剩余权益状态\n不得遗漏 07 借贷相等校验',5,1)
p.n('expired','权益为已过期(退款)？',6,1,kind='decision')
p.n('settle','一次确认剩余收入 x=A-R\n贷：主营业务收入 x；借：合同负债 x\n统计时间=G；更新 R、L',7,1)
p.n('keep','权益继续可用\n新 d=N/(E-S)\n复用 03 每日收入确认',7,2)
p.n('finished','状态：完成分摊\n转 07 校验',8,1)
p.n('less','N<R：状态为分摊异常\n飞书预警与备注：\n部分退款后收入小于已确认收入',2,2,kind='error')
p.e('start','equal');p.e('equal','equalbook','是');p.e('equal','greater','否',True)
p.e('equalbook','equalend');p.e('greater','ratio','是');p.e('greater','less','否',True)
p.e('ratio','calc');p.e('calc','book');p.e('book','refresh');p.e('refresh','expired')
p.e('expired','settle','是');p.e('expired','keep','否',True);p.e('settle','finished')
p.note('D4（P24）：原文 X、Y 可出现负值，退回口径与按履约比例分配不一致。例如 I=100、R=20、L=80、Q=10、N=90、p=20%，得到 X=18、Y=-8，且 X+Y=10；虽借贷总额相等，却出现负的负债退回额，且X并非按比例退回2。该公式及业务含义需确认。')
p.note('建议待确认口径：若意图按原履约比例分配本笔退款，则 X=Q×p、Y=Q-X（本例 X=2，Y=8）。本图主节点保留 PRD 原式；建议未替换原文。')
p.note('部分退款后 d=N/(E-S) 同样沿用 PRD。多笔部分退款时，应明确 N 的事件时点快照与从何日开始采用新 d；不能用最终净收入提前覆盖退款日前的历史分摊。')

p=Page('checks','07 统一数据校验、余额更新与状态收口','所有收入 / 退款子流程统一校验明细，并更新订单余额与分摊状态。','PDF 第 6、13、26 页')
p.n('start','本轮收入 / 退款明细生成后',0,kind='terminal')
p.n('balance','本次生成的借记总额\n等于贷记总额？',1,kind='decision')
p.n('badbalance','记录金额异常并预警\n无法生成有效明细时：分摊异常\n待排查相关金额与借贷方向',1,1,kind='error')
p.n('integrity','应生成的配对明细完整？',2,kind='decision')
p.n('missing','飞书预警：分摊数据不完整\n检查应收/负债、收入/负债配对\n以及费用与退款对应记录',2,1,kind='error')
p.n('update','更新已确认收入\nR=主营业务收入贷记总额\n - 主营业务收入借记总额',3)
p.n('L','更新剩余合同负债\nL=财务费用借减贷 + 平台应收借减贷\n - 已确认收入 R',4)
p.n('finish','子流程已要求完成，或\n权益到期，或 L=0？',5,kind='decision')
p.n('ongoing','状态：分摊中\n后续每日继续分摊\n未生效/缺输入则等待满足条件',5,1)
p.n('finalcheck','完成时 A+V=R？\nA=应收借减贷；V=费用借减贷',6,kind='decision')
p.n('amountbad','记录异常备注：\n完成分摊(金额异常)\n发送飞书预警，等待排查',6,1,kind='error')
p.n('completed','状态：完成分摊\n结束本轮常规收入分摊\n后续新退款 / 退款撤销另行触发',7)
p.n('end','本轮结束',8,kind='terminal')
p.e('start','balance');p.e('balance','integrity','是');p.e('balance','badbalance','否',True)
p.e('integrity','update','是');p.e('integrity','missing','否',True)
p.e('update','L');p.e('L','finish');p.e('finish','finalcheck','是');p.e('finish','ongoing','否',True)
p.e('finalcheck','completed','是');p.e('finalcheck','amountbad','否',True);p.e('completed','end')
p.note('状态规则：待分摊→首次有效分摊后分摊中→权益到期或负债清零后完成分摊；任何异常导致明细无法生成→分摊异常。系统执行异常自动重试；其他异常在后管修改参数后等待下次执行。具体异常后的恢复状态原文未定义。')
p.note('完整性检查应与子流程预期对应：同日 N=0 按原文不生成金额明细；权益尚未生效只保留应收与负债。这两类不能直接套用「缺收入记录」判为不完整。')
p.note('待确认口径索引：D0 调度时刻；D1 首次登记条件与锁定；D2 到期尾差公式；D3 同日退款借贷及未指明科目；D4 部分退款退回公式；D5 已完成后全退费用；D6 已完成订单退款入口；D7 首次区间边界。')

def straight_layout():
    moves = {
        'normal': {'daily': (5,2), 'ongoing': (10,2)},
        'sameday': {'zero': (3,0), 'zeroaction': (4,0), 'positive': (3,1),
                    'negative': (3,2), 'endneg': (4,2), 'remain': (5,2), 'wait': (1,2)},
        'fullrefund': {'cut': (4,0), 'full': (5,0), 'wasdone': (6,0), 'valid': (7,0),
                       'reverse': (8,0), 'fee': (9,0), 'nofee': (9,1), 'bookfee': (10,0),
                       'update': (11,0), 'wait': (2,2)},
        'partial': {'less': (1,2), 'keep': (6,2)},
    }
    for pi,p in enumerate(PAGES):
        for n in p.nodes.values():
            row=(n['y']-180)/180
            col=round((n['x']-(380-n['w'])/2-90)/570)
            row,col=moves.get(p.id,{}).get(n['id'],(row,col))
            n['x']=90+570*col+(380-n['w'])/2
            n['y']=250+230*row-n['h']/2
        p.badges={}
        original=list(p.nodes)
        for i,e in enumerate(p.edges):
            a,b=p.nodes[e['s']],p.nodes[e['t']]
            ac=a['x']+a['w']/2;bc=b['x']+b['w']/2
            ay=a['y']+a['h']/2;by=b['y']+b['h']/2
            aligned=(e['side'] and ay==by and b['x']>a['x']) or (not e['side'] and ac==bc and b['y']>a['y']+a['h'])
            if aligned:continue
            assert a['kind']!='decision',(p.id,e)
            # Long returns and cross-column merges use explicit same-page references.
            target=e['t'];code=chr(65+pi)+f'{original.index(target)+1:02}'
            p.badges[target]=code
            refid=f'ref_{i}'
            p.nodes[refid]=dict(id=refid,text=f'继续至 {code}',x=ac-100,y=a['y']+a['h']+30,w=200,h=44,kind='ref')
            e['t']=refid;e['side']=False;e['via']=None
        if p.badges:
            p.notes.insert(0,'阅读方式：全部箭头为单段横线或竖线。为避免长距离折返，使用「继续至编号」接续；对应节点左上角标有相同编号。编号仅表示同页流程连接，不新增业务步骤。')

straight_layout()
COLORS['ref']=('#EEEBFA','#8574AE')

LEGEND = '符号：I 初始平台应收款；N 当前退款后净收入；Q 本笔净退款额；R 已确认收入；L 剩余合同负债；S/E 权益生效/过期；F/G 收入/退款登记日末；C 分摊截止；A 应收借减贷；V 费用借减贷。'

def wrap(text, font, maxwidth):
    lines=[]
    for line in text.split('\n'):
        cur=''
        for c in line:
            if font.getlength(cur+c)>maxwidth and cur:
                lines.append(cur);cur=c
            else:cur+=c
        lines.append(cur)
    return lines

def crosses(points,nodes,exclude=()):
    for a,b in zip(points,points[1:]):
        for n in nodes:
            if n['id'] in exclude:continue
            x,y,w,h=n['x'],n['y'],n['w'],n['h']
            if a[0]==b[0] and x-8<a[0]<x+w+8 and max(min(a[1],b[1]),y-8)<min(max(a[1],b[1]),y+h+8):return True
            if a[1]==b[1] and y-8<a[1]<y+h+8 and max(min(a[0],b[0]),x-8)<min(max(a[0],b[0]),x+w+8):return True
    return False

def route(p,e):
    a,b=p.nodes[e['s']],p.nodes[e['t']]
    if e['side']:
        pts=[(a['x']+a['w'],a['y']+a['h']/2),(b['x'],b['y']+b['h']/2)]
    else:
        pts=[(a['x']+a['w']/2,a['y']+a['h']),(b['x']+b['w']/2,b['y'])]
    assert pts[0][0]==pts[1][0] or pts[0][1]==pts[1][1],(p.id,e)
    assert not crosses(pts,list(p.nodes.values()),(e['s'],e['t'])),(p.id,e)
    return pts

def emit_xml(p):
    model=ET.Element('mxGraphModel',dx='1400',dy='1000',grid='1',gridSize='10',page='0',pageScale='1',background='#FFFFFF')
    root=ET.SubElement(model,'root');ET.SubElement(root,'mxCell',id='0');ET.SubElement(root,'mxCell',id='1',parent='0')
    def cell(id,text,x,y,w,h,style):
        el=ET.SubElement(root,'mxCell',id=id,value=text,style=style,vertex='1',parent='1')
        ET.SubElement(el,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
    width=max(n['x']+n['w'] for n in p.nodes.values())+130
    title_style='text;html=0;align=left;verticalAlign=middle;fontFamily=Helvetica;fontColor=#16334D;'
    cell('title',p.title,65,25,width-100,55,title_style+'fontSize=30;fontStyle=1;')
    cell('subtitle',p.subtitle,65,88,width-100,60,title_style+'fontSize=17;whiteSpace=wrap;')
    for n in p.nodes.values():
        fill,stroke=COLORS[n['kind']]
        shape='rhombus;' if n['kind']=='decision' else ('rounded=1;arcSize=50;' if n['kind'] in ('terminal','ref') else 'rounded=0;')
        style=shape+f'whiteSpace=wrap;html=0;fontFamily=Helvetica;fontSize=17;fontColor=#1D3447;fillColor={fill};strokeColor={stroke};strokeWidth=1.5;spacing=9;align=center;verticalAlign=middle;'
        cell(n['id'],n['text'],n['x'],n['y'],n['w'],n['h'],style)
        if n['id'] in p.badges:
            cell('badge_'+n['id'],p.badges[n['id']],n['x'],n['y']-21,60,18,'text;html=0;fontSize=13;fontStyle=1;align=left;fontColor=#776096;')
    for i,e in enumerate(p.edges):
        pts=route(p,e)
        a,b=p.nodes[e['s']],p.nodes[e['t']]
        ex,ey=(1,.5) if e['side'] and a['kind']=='decision' else (.5,1)
        # One vertical continuation and one side departure per decision.
        entx,enty=(0,.5) if len(pts)==2 and pts[0][1]==pts[1][1] else (.5,0)
        style=f'edgeStyle=none;rounded=0;html=0;strokeColor=#65788A;strokeWidth=1.6;endArrow=block;endFill=1;fontSize=15;labelBackgroundColor=#FFFFFF;exitX={ex};exitY={ey};entryX={entx};entryY={enty};'
        c=ET.SubElement(root,'mxCell',id=f'edge{i}',value=e['label'],style=style,edge='1',parent='1',source=e['s'],target=e['t'])
        g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
        if len(pts)>2:
            ar=ET.SubElement(g,'Array',attrib={'as':'points'})
            for x,y in pts[1:-1]:ET.SubElement(ar,'mxPoint',x=str(x),y=str(y))
    y=max(n['y']+n['h'] for n in p.nodes.values())+85
    for j,text in enumerate(p.notes+[LEGEND,'来源：'+p.source]):
        lines=wrap(text,ImageFont.truetype(FONT,17),width-170)
        h=len(lines)*26+28
        cell(f'note{j}',text,65,y,width-110,h,'rounded=0;html=0;whiteSpace=wrap;align=left;verticalAlign=middle;spacing=14;fontSize=16;fontColor=#72552F;fillColor=#FFF9EE;strokeColor=#DBC7A4;')
        y+=h+14
    return model,width,y+40

def render(p,width,height):
    im=Image.new('RGB',(int(width),int(height)),'white');d=ImageDraw.Draw(im)
    f=ImageFont.truetype(FONT,18);small=ImageFont.truetype(FONT,17);title=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',30)
    d.text((65,34),p.title,font=title,fill='#16334D')
    for i,line in enumerate(wrap(p.subtitle,small,width-130)):d.text((65,94+i*25),line,font=small,fill='#506779')
    for e in p.edges:
        pts=route(p,e);d.line(pts,fill='#65788A',width=2,joint='curve')
        x,y=pts[-1];px,py=pts[-2];ang=math.atan2(y-py,x-px)
        arrow=[(x,y),(x-10*math.cos(ang-.45),y-10*math.sin(ang-.45)),(x-10*math.cos(ang+.45),y-10*math.sin(ang+.45))]
        d.polygon(arrow,fill='#65788A')
        if e['label']:
            x0,y0=pts[0];x1,y1=pts[1];xx=x0+22 if x1!=x0 else x0+12;yy=y0+9 if x1!=x0 else y0+18
            box=d.textbbox((xx,yy),e['label'],font=small);d.rectangle((box[0]-3,box[1]-2,box[2]+3,box[3]+2),fill='white');d.text((xx,yy),e['label'],font=small,fill='#526579')
    for n in p.nodes.values():
        x,y,w,h=n['x'],n['y'],n['w'],n['h'];fill,stroke=COLORS[n['kind']]
        if n['kind']=='decision':d.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)],fill=fill,outline=stroke,width=2)
        elif n['kind'] in ('terminal','ref'):d.rounded_rectangle((x,y,x+w,y+h),radius=min(36,h/2),fill=fill,outline=stroke,width=2)
        else:d.rectangle((x,y,x+w,y+h),fill=fill,outline=stroke,width=2)
        if n['id'] in p.badges:d.text((x,y-21),p.badges[n['id']],font=ImageFont.truetype(FONT,13),fill='#776096')
        lines=wrap(n['text'],f,w-45 if n['kind']!='decision' else w*.69)
        assert len(lines)*26<=h-12,(p.id,n['id'],lines)
        yy=y+(h-len(lines)*26)/2
        for line in lines:
            d.text((x+(w-f.getlength(line))/2,yy),line,font=f,fill='#1D3447');yy+=26
    y=max(n['y']+n['h'] for n in p.nodes.values())+85
    for text in p.notes+[LEGEND,'来源：'+p.source]:
        lines=wrap(text,small,width-170);h=len(lines)*26+28
        d.rectangle((65,y,width-45,y+h),fill='#FFF9EE',outline='#DBC7A4',width=1)
        for i,line in enumerate(lines):d.text((80,y+14+i*26),line,font=small,fill='#72552F')
        y+=h+14
    im.save(OUT/(p.title[:2]+'-'+p.id+'.png'))
    return im

mx=ET.Element('mxfile',host='app.diagrams.net',version='26.0.0',type='device')
previews=[]
for p in PAGES:
    model,w,h=emit_xml(p)
    diag=ET.SubElement(mx,'diagram',id=p.id,name=p.title);diag.append(model)
    (OUT/(p.id+'.xml')).write_text(ET.tostring(model,encoding='unicode'))
    previews.append(render(p,w,h))
    # Structural checks: every decision has exactly two labeled exits.
    for n in p.nodes.values():
        if n['kind']=='decision':
            es=[e for e in p.edges if e['s']==n['id']]
            assert len(es)==2 and all(e['label'] for e in es),(p.id,n['id'])
    for e in p.edges:
        assert e['s'] in p.nodes and e['t'] in p.nodes
        points=route(p,e)
        assert all(a[0]==b[0] or a[1]==b[1] for a,b in zip(points,points[1:])),e

path=OUT/'订阅收入分摊完整流程图.drawio'
ET.indent(mx)
path.write_text(ET.tostring(mx,encoding='unicode',xml_declaration=True))
ET.parse(path)
tw=380;thumbs=[]
for im in previews:
    th=im.copy();th.thumbnail((tw,1100));thumbs.append(th)
sheet=Image.new('RGB',(tw*4,1250*2),'#E7EDF3')
for i,th in enumerate(thumbs):sheet.paste(th,((i%4)*tw,(i//4)*1250))
sheet.save(OUT/'流程图总览.png')
(OUT/'阅读说明.txt').write_text('订阅收入分摊完整流程图\n\n依据用户提供 PDF 第17–26页，结合第14–15、27页特殊场景。\n可编辑主文件：订阅收入分摊完整流程图.drawio，包含7个页面。\nPNG为相同节点与连线的阅读预览。\n\n'+ '\n\n'.join(p.title+'\n'+'\n'.join(p.notes) for p in PAGES))
print(f'已生成 {len(PAGES)} 页，共 {sum(len(p.nodes) for p in PAGES)} 个流程节点、{sum(len(p.edges) for p in PAGES)} 条连接。')
print(path)
