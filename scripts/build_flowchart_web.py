"""Export the current editable draw.io file to a buildless, vector HTML viewer."""
from pathlib import Path
import base64
import json
import hashlib
import re
import zlib
import xml.etree.ElementTree as ET
from html import escape
from html.parser import HTMLParser
from urllib.parse import quote, unquote

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'flowcharts'
OUT.mkdir(exist_ok=True)

class PlainText(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):self.parts.append(data)
    def handle_starttag(self,tag,attrs):
        if tag=='br':self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag=='div':self.parts.append('\n')

def plain(value):
    parser=PlainText();parser.feed(value)
    return '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())

def style(cell):
    return dict(s.split('=',1) for s in cell.get('style','').split(';') if '=' in s)

def xywh(cell):
    g=cell.find('mxGeometry')
    return tuple(float(g.get(k,0)) for k in ('x','y','width','height'))

def make_svg(model):
    cells=model.findall('./root/mxCell')
    nodes={c.get('id'):c for c in cells if c.get('vertex')=='1' and c.get('id') not in ('title','subtitle') and not c.get('id').startswith(('note','badge_'))}
    edges=[c for c in cells if c.get('edge')=='1']
    paths=[];labels=[];bounds=[]
    for cell in edges:
        a=nodes[cell.get('source')];b=nodes[cell.get('target')];s=style(cell)
        ax,ay,aw,ah=xywh(a);bx,by,bw,bh=xywh(b)
        points=[(ax+aw*float(s.get('exitX','.5')),ay+ah*float(s.get('exitY','1')))]
        points.extend((float(p.get('x')),float(p.get('y'))) for p in cell.findall('./mxGeometry/Array/mxPoint'))
        points.append((bx+bw*float(s.get('entryX','.5')),by+bh*float(s.get('entryY','0'))))
        points=[p for i,p in enumerate(points) if i==0 or p!=points[i-1]]
        assert all(a[0]==b[0] or a[1]==b[1] for a,b in zip(points,points[1:])),cell.get('id')
        bounds+=points
        paths.append('<polyline points="'+' '.join(f'{x:g},{y:g}' for x,y in points)+'" fill="none" stroke="#7C8D9F" stroke-width="1.8" marker-end="url(#arrow)"/>')
        if cell.get('value'):
            (x,y),(nx,ny)=points[:2]
            lx=x+26 if nx!=x else x+17;ly=y-9 if nx!=x else y+27
            labels.append(f'<g><rect x="{lx-10}" y="{ly-18}" width="32" height="28" rx="5" fill="white"/><text x="{lx+6}" y="{ly+2}" text-anchor="middle" font-size="17" fill="#526779">{escape(cell.get("value"))}</text></g>')
    shapes=[];details=[]
    for node_id,cell in nodes.items():
        x,y,w,h=xywh(cell);s=style(cell);raw=cell.get('value','');rich=s.get('html')=='1'
        text=plain(raw) if rich else raw
        is_diamond='rhombus' in cell.get('style','')
        kind='decision' if is_diamond else 'terminal' if s.get('rounded')=='1' else 'process'
        fill=s.get('fillColor','#EFF6FF');stroke=s.get('strokeColor','#6087BA')
        if fill=='#FFF0EE':kind='warning'
        shape=(f'<polygon points="{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}"' if is_diamond else f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(38,h/2) if kind=="terminal" else 6}"')+f' fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
        if rich:content=raw
        else:
            lines=raw.split('\n')
            content='<div style="font-size:20px;line-height:26px;color:#1D3447;text-align:center">'+('<b>'+escape(lines[0])+'</b><br>' if len(lines)>1 and kind!='decision' else '')+'<br>'.join(escape(line) for line in (lines[1:] if len(lines)>1 and kind!='decision' else lines))+'</div>'
        content=content.replace('<br>','<br/>')
        inner_w=w*.70 if is_diamond else w-44
        fx=x+(w-inner_w)/2
        div=f'<div xmlns="http://www.w3.org/1999/xhtml" class="node-label" style="height:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-family:Arial,\'PingFang SC\',\'Microsoft YaHei\',sans-serif">{content}</div>'
        try:ET.fromstring(div)
        except ET.ParseError as exc:raise ValueError((node_id,exc))
        shapes.append(f'<g class="flow-node" data-node="{node_id}" role="button" tabindex="0" aria-label="{escape(text,quote=True)}"><title>{escape(text)}</title>{shape}<foreignObject x="{fx}" y="{y}" width="{inner_w}" height="{h}">{div}</foreignObject></g>')
        details.append(dict(id=node_id,title=text.split('\n')[0],text=text,html=content,kind=kind))
        bounds.extend([(x,y),(x+w,y+h)])
    width=max(x for x,y in bounds)+55
    height=max(y for x,y in bounds)+55-180
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}" height="{height:g}" viewBox="0 180 {width:g} {height:g}" role="img" aria-label="收入分摊业务流程图"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7C8D9F"/></marker></defs>'+''.join(paths+labels+shapes)+'</svg>'
    return svg,width,height,details

mxfile=ET.parse(ROOT/'收入分摊流程图.drawio').getroot()
pages=[]
for i,diagram in enumerate(mxfile.findall('diagram')):
    model=diagram.find('mxGraphModel')
    if model is None:model=ET.fromstring(unquote(zlib.decompress(base64.b64decode(diagram.text),-15).decode()))
    cells=model.findall('./root/mxCell')
    byid={c.get('id'):c for c in cells}
    svg,w,h,nodes=make_svg(model)
    notes=[c.get('value') for c in cells if re.fullmatch(r'note\d+',c.get('id',''))]
    title=diagram.get('name').split('、',1)[1].strip('「」')
    pages.append(dict(id=diagram.get('id'),number=i+1,title=title,description=byid['subtitle'].get('value'),rules=notes[1:-2],source=notes[-1].removeprefix('来源：'),svg=svg,width=w,height=h,nodes=nodes,decisions=sum(n['kind']=='decision' for n in nodes)))
editor_xml=ET.tostring(mxfile,encoding='unicode')
packed=zlib.compressobj(wbits=-15)
encoded=quote(editor_xml,safe="~()*!.'-").encode()
editor_data=base64.b64encode(packed.compress(encoded)+packed.flush()).decode()
payload=dict(pages=pages,editorData=editor_data,revision='flow-library-v1',sourceDigest=hashlib.sha256((ROOT/'收入分摊流程图.drawio').read_bytes()).hexdigest())
(OUT/'data.js').write_text('window.REVENUE_FLOWS = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
index=(OUT/'index.html').read_text()
for asset in ('styles.css','app.js','data.js'):
    digest=hashlib.sha256((OUT/asset).read_bytes()).hexdigest()[:12]
    index=re.sub(re.escape(asset)+r'\?v=[a-zA-Z0-9-]+',asset+'?v='+digest,index)
(OUT/'index.html').write_text(index)
print(f'Generated {len(pages)} vector flowcharts in {OUT}/data.js')
