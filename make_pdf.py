from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import simpleSplit
from pathlib import Path
out=Path('個人行程管理系統_前端原型說明.pdf')
font=TTFont('MSJH',r'C:\Windows\Fonts\msjh.ttc',subfontIndex=0)
pdfmetrics.registerFont(font)
c=canvas.Canvas(str(out),pagesize=A4)
W,H=A4
ink=HexColor('#26352f'); green=HexColor('#3f765e'); muted=HexColor('#718078'); pale=HexColor('#eaf2eb'); line=HexColor('#e8ede7')
def wrap(text,x,y,width,size=10,leading=16,color=ink,fontname='MSJH'):
    c.setFont(fontname,size); c.setFillColor(color)
    for line_text in simpleSplit(text,fontname,size,width):
        c.drawString(x,y,line_text); y-=leading
    return y

def header(tag,title,sub):
    c.setFillColor(HexColor('#f6f8f4')); c.rect(0,H-155,W,155,fill=1,stroke=0)
    c.setFillColor(green);c.roundRect(42,H-73,36,36,10,fill=1,stroke=0)
    c.setFillColor(white);c.setFont('MSJH',16);c.drawCentredString(60,H-61,'拾')
    c.setFillColor(muted);c.setFont('MSJH',9);c.drawString(90,H-54,tag)
    c.setFillColor(ink);c.setFont('MSJH',23);c.drawString(42,H-105,title)
    wrap(sub,42,H-130,W-84,10,15,muted)

def footer(n):
    c.setStrokeColor(line);c.line(42,38,W-42,38)
    c.setFillColor(muted);c.setFont('MSJH',8);c.drawString(42,24,'日常拾光｜個人行程與任務管理原型')
    c.drawRightString(W-42,24,f'{n:02d}')

# Cover / overview
header('產品原型說明','日常拾光','每日清單 × 可愛像素夥伴｜可操作前端原型')
y=H-188
c.setFillColor(pale);c.roundRect(42,y-96,W-84,90,16,fill=1,stroke=0)
y=wrap('設計方向',60,y-29,W-120,12,19,green)
y=wrap('把生活中所有值得提醒的事情，放進清爽的每日清單；完成日常時，也能回到小小寵物房，看看夥伴活動、摸摸牠、餵零食、丟玩具。',60,y-4,W-120,10,16,ink)
y-=35
c.setFillColor(ink);c.setFont('MSJH',14);c.drawString(42,y,'這份原型包含')
y-=26
items=[('每日清單','日期橫向切換，查看過去、今天與未來；完成和未完成分區呈現。'),('自由配色','新增事項時直接挑選卡片顏色，不綁定生活／工作等分類名稱。'),('事項詳情','備註收在詳情中，支援時間、重複選項和系統內到期提示。'),('像素寵物房','全身小動物造型、房間場景、像素動畫、摸摸／餵食／玩耍互動與自主活動。'),('本機儲存','瀏覽器 localStorage 保存原型資料；跨裝置同步尚需帳號與後端服務。')]
for title,desc in items:
    c.setFillColor(green);c.circle(49,y+2,3,fill=1,stroke=0)
    c.setFillColor(ink);c.setFont('MSJH',10);c.drawString(61,y,title)
    y=wrap(desc,61,y-17,W-105,9,14,muted);y-=13
footer(1);c.showPage()

# Reference & explicit boundaries
header('互動概念','寵物不只是圖示','用桌面寵物遊戲的生活感作為靈感，重新整理互動體驗。')
y=H-184
sections=[('場景與生命感','天空、草地、花朵與小屋氛圍，讓寵物像住在自己的小空間；動畫在散步、休息、眨眼等狀態間變化。'),('可操作互動','點擊寵物可摸摸牠；餵零食、丟玩具、觀看牠玩耍，呈現不同動作、表情與短文字回饋。'),('收藏與成長','完成事項累積經驗，逐步收藏不同夥伴；休息不扣進度，不設定死亡、飢餓懲罰或連續登入壓力。'),('參考界線','Steam《桌寵屋》公開頁面提及像素風格、桌面活動、收集、房間與冒險。本原型只借鑑「陪伴、收藏、可互動」的概念，不使用其角色、美術或素材。')]
for title,body in sections:
    c.setFillColor(white);c.setStrokeColor(line);c.roundRect(42,y-91,W-84,78,14,fill=1,stroke=1)
    c.setFillColor(green);c.setFont('MSJH',11);c.drawString(58,y-35,title)
    wrap(body,58,y-56,W-116,9,14,muted)
    y-=101
c.setFillColor(HexColor('#fff5dd'));c.roundRect(42,100,W-84,82,14,fill=1,stroke=0)
wrap('目前限制',58,160,W-116,10,16,HexColor('#846b34'))
wrap('這是單頁前端概念原型。提醒只在頁面開啟時顯示；跨裝置同步、帳號登入與作業系統推播尚未串接。像素角色與場景以原型內繪圖實作，後續可替換為專業逐格動畫精靈圖。',58,140,W-116,9,14,HexColor('#846b34'))
footer(2);c.save();print(out.resolve())
