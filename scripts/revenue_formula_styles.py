"""Editable formula panels shared by draw.io HTML labels and the PNG renderer."""
from html import escape
import re

# Explicit line breaks occur at operators; account names remain intact.
FORMULAS = {
 'dates': {
  'fpay': ('确定首次收入登记时间', [('时间选取', ['首次收入登记时间取', '支付成功时间对应日期的日末'])], ''),
  'fcut': ('确定首次收入登记时间', [('时间选取', ['首次收入登记时间取本次收入分摊截止时间'])], ''),
  'gpay': ('确定退款登记时间', [('时间选取', ['退款登记时间取退款时间对应日期的日末'])], ''),
  'gcut': ('确定退款登记时间', [('时间选取', ['退款登记时间取本次收入分摊截止时间'])], ''),
 },
 'normal': {
  'iterate': ('按日期先后处理需要补充的分摊日', [('计算公式 · 每日预估收入', ['每日预估收入＝初始平台应收账款', '÷（权益过期时间－权益生效时间）'])], '时间差统一换算为天数'),
  'firstvalue': ('计算首次确认的主营业务收入', [('计算公式 · 首次确认金额', ['主营业务收入金额＝', '（首次收入登记时间－权益生效时间）', '× 每日预估收入'])], '金额四舍五入，保留三位小数'),
  'tail': ('按到期公式计算本次主营业务收入', [('计算公式 · 到期确认金额', ['主营业务收入＝平台应收账款借记总和', '－平台应收账款贷记总和', '－（已分摊主营业务收入借记总和', '－已分摊主营业务收入贷记总和）'])], ''),
  'daily': ('权益尚未到期，确认当期收入', [('计算公式 · 当期确认金额', ['本次主营业务收入＝每日预估收入'])], '适用条件：权益过期时间 > 收入登记时间'),
 },
 'sameday': {
  'remain': ('权益仍可使用，继续按日确认收入', [('计算公式 · 每日预估收入', ['每日预估收入＝净收入', '÷（权益过期时间－权益生效时间）'])], '按三、「无退款收入分摊」的每日确认流程处理'),
 },
 'fullrefund': {
  'reverse': ('冲回已确认收入与剩余合同负债', [('计算公式 · 平台应收账款贷记金额', ['平台应收账款贷记金额＝', '净收入绝对值＋本笔净退款额'])], '贷记：平台应收账款，金额见计算公式\n借记：合同负债，金额为剩余合同负债\n借记：主营业务收入，金额为已确认收入'),
 },
 'partial': {
  'ratio': ('计算已履约比例', [('计算公式', ['已履约比例＝', '已确认收入 ÷ 初始平台应收账款 × 100%'])], '比例保留两位小数'),
  'calc': ('按原文计算需要退回的金额', [('公式一 · 已确认收入退回金额', ['＝已确认收入－本笔净退款额 × 已履约比例']), ('公式二 · 合同负债退回金额', ['＝剩余合同负债－（退款后剩余收入', '－本笔净退款额 × 已履约比例）'])], '金额保留三位小数；原文公式待确认'),
  'settle': ('一次确认剩余尚未确认的主营业务收入', [('计算公式 · 本次确认金额', ['金额＝平台应收账款借记总额', '－平台应收账款贷记总额－已确认收入'])], '贷记：主营业务收入，金额见计算公式\n借记：合同负债，金额见计算公式\n明细统计时间为退款登记时间'),
  'keep': ('权益仍可使用，继续按日分摊', [('计算公式 · 每日预估收入', ['每日预估收入＝净收入', '÷（权益过期时间－权益生效时间）'])], '按三、「无退款收入分摊」的每日确认流程处理'),
 },
 'checks': {
  'calc': ('计算完成分摊校验金额', [('计算公式 · 指定借贷净额', ['完成分摊校验金额＝', '平台应收账款借记总额－平台应收账款贷记总额', '＋财务费用借记总额－财务费用贷记总额'])], ''),
 },
}

BG, INK, BORDER = '#F1EDFF', '#553B94', '#C2B0E4'
TIME=('#EAF3FF','#2D5F91','#A9C4E3')
DEBIT=('#E3F5ED','#126248','#82BBA6')
CREDIT=('#FFF0DF','#91470D','#D9AD7F')

def row_palette(line):
    if line.startswith('借记'):return DEBIT
    if line.startswith('贷记'):return CREDIT
    if '统计时间' in line:return TIME
    return None

def posting_node(node):
    return node['kind'] not in ('decision','terminal') and any(line.startswith(('借记','贷记')) for line in node['text'].split('\n')[1:])

def styled_row(line,size=20):
    palette=row_palette(line)
    bg,ink,border=palette or ('transparent','#526779','transparent')
    weight='bold' if palette in (DEBIT,CREDIT) else 'normal'
    return f'<div style="background:{bg};color:{ink};font-size:{size}px;line-height:28px;font-weight:{weight};padding:2px 8px;text-align:left;white-space:nowrap">{escape(line)}</div>'

def marked_terms(line):
    return escape(line).replace('借记',f'<b style="color:{DEBIT[1]}">借记</b>').replace('贷记',f'<b style="color:{CREDIT[1]}">贷记</b>')

def draw_terms(d,xy,line,font,ink):
    x,y=xy
    for chunk in re.split('(借记|贷记)',line):
        color=DEBIT[1] if chunk=='借记' else CREDIT[1] if chunk=='贷记' else ink
        d.text((x,y),chunk,font=font,fill=color)
        x+=font.getlength(chunk)

def blocks(node):
    title, groups, foot = node['formula']
    # Lines are explicit and never passed to character-based wrapping.
    total=28+10+sum(22+len(lines)*26+16 for _,lines in groups)+10*(len(groups)-1)
    if foot: total+=10+len(foot.split('\n'))*24
    assert total <= node['h']-24, (node['id'],total,node['h'])
    return title,groups,foot,total

def html_label(node):
    title,groups,foot,_=blocks(node)
    parts=[f'<div style="font-size:20px;font-weight:bold;line-height:28px;color:#1D3447;white-space:nowrap">{escape(title)}</div>']
    for label,lines in groups:
        bg,ink,border=TIME if '时间' in label else (BG,INK,BORDER)
        body='<br>'.join(marked_terms(line) for line in lines)
        parts.append(f'<div style="margin-top:10px;padding:8px 12px;background:{bg};border:1px solid {border};text-align:left">'
                     f'<div style="font-size:17px;font-weight:bold;line-height:22px;color:{ink};white-space:nowrap">{marked_terms(label)}</div>'
                     f'<div style="font-size:20px;line-height:26px;color:{ink};white-space:nowrap">{body}</div></div>')
    if foot:
        parts.append('<div style="margin-top:10px">'+''.join(styled_row(line,17) for line in foot.split('\n'))+'</div>')
    return '<div style="width:548px;text-align:center;font-family:Helvetica">'+''.join(parts)+'</div>'

def draw_formula(d,node,scope):
    ImageFont,FONT=scope['ImageFont'],scope['FONT']
    body=ImageFont.truetype(FONT,20)
    small=ImageFont.truetype(FONT,17)
    bold=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
    title,groups,foot,total=blocks(node)
    x,y,w,h=node['x'],node['y'],node['w'],node['h']
    d.rectangle((x,y,x+w,y+h),fill='#F8FAFF',outline='#6087BA',width=2)
    top=y+(h-total)/2
    assert bold.getlength(title)<=w-44,(node['id'],title)
    d.text((x+(w-bold.getlength(title))/2,top),title,font=bold,fill='#1D3447');top+=38
    for label,lines in groups:
        bg,ink,border=TIME if '时间' in label else (BG,INK,BORDER)
        panel_h=22+len(lines)*26+16
        d.rectangle((x+26,top,x+w-26,top+panel_h),fill=bg,outline=border,width=1)
        d.text((x+38,top+8),label,font=small,fill=ink)
        for i,line in enumerate(lines):
            assert body.getlength(line)<=w-76,(node['id'],line,body.getlength(line))
            draw_terms(d,(x+38,top+30+i*26),line,body,ink)
        top+=panel_h+10
    if foot:
        for line in foot.split('\n'):
            assert small.getlength(line)<=w-44,(node['id'],line)
            palette=row_palette(line)
            if palette:
                d.rectangle((x+26,top,x+w-26,top+24),fill=palette[0])
                d.text((x+34,top+2),line,font=small,fill=palette[1])
            else:d.text((x+(w-small.getlength(line))/2,top),line,font=small,fill='#526779')
            top+=24

def draw_posting(d,node,scope):
    x,y,w,h=node['x'],node['y'],node['w'],node['h']
    lines=node['text'].split('\n')
    title,rows=lines[0],lines[1:]
    font=scope['ImageFont'].truetype(scope['FONT'],20)
    bold=scope['ImageFont'].truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
    total=32+len(rows)*36
    assert total<=h-20,(node['id'],total,h)
    d.rectangle((x,y,x+w,y+h),fill='#F8FAFF',outline='#6087BA',width=2)
    top=y+(h-total)/2
    assert bold.getlength(title)<=w-44,(node['id'],title)
    d.text((x+(w-bold.getlength(title))/2,top),title,font=bold,fill='#1D3447');top+=32
    for line in rows:
        assert font.getlength(line)<=w-68,(node['id'],line,font.getlength(line))
        palette=row_palette(line)
        if palette:
            d.rectangle((x+26,top,x+w-26,top+32),fill=palette[0])
            d.text((x+34,top+4),line,font=bold if palette in (DEBIT,CREDIT) else font,fill=palette[1])
        else:d.text((x+(w-font.getlength(line))/2,top+4),line,font=font,fill='#526779')
        top+=36

def draw_formula_condition(d,node,scope):
    x,y,w,h=node['x'],node['y'],node['w'],node['h']
    d.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)],fill='#FFF6DE',outline='#B68A35',width=2)
    font=scope['ImageFont'].truetype(scope['FONT'],20)
    lines=['【校验公式】']+node['text'].split('\n')
    top=y+(h-len(lines)*26)/2
    for line in lines:
        draw_terms(d,(x+(w-font.getlength(line))/2,top),line,font,INK);top+=26

def style_xml(model,p):
    for cell in model.findall('./root/mxCell'):
        node=p.nodes.get(cell.get('id'))
        if node and 'formula' in node:
            cell.set('value',html_label(node))
            cell.set('style',cell.get('style').replace('html=0','html=1').replace('fillColor=#EFF6FF','fillColor=#F8FAFF')+'overflow=visible;spacing=0;')
        elif node and node.get('formula_condition'):
            cell.set('value','<div style="font-size:20px;line-height:26px;color:'+INK+'"><b>【校验公式】</b><br>'+marked_terms(node['text']).replace('\n','<br>')+'</div>')
            cell.set('style',cell.get('style').replace('html=0','html=1'))
        elif node and posting_node(node):
            lines=node['text'].split('\n')
            title=f'<div style="font-size:20px;font-weight:bold;line-height:28px;margin-bottom:8px;color:#1D3447;white-space:nowrap">{escape(lines[0])}</div>'
            cell.set('value','<div style="width:548px;text-align:center">'+title+''.join(styled_row(line) for line in lines[1:])+'</div>')
            cell.set('style',cell.get('style').replace('html=0','html=1')+'spacing=0;')
