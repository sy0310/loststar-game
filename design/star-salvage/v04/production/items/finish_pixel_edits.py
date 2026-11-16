"""Declared native-grid edits after inspecting the24px candidates on the shared palette."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
from render_items import native
P=Path(__file__).parent
edits=json.loads((P/'pixel-edits.json').read_text())
def save(id,coords):edits[id]=[[x,y,c]for(x,y),c in sorted(coords.items(),key=lambda t:(t[0][1],t[0][0]))]
# Exposed chip contacts and the central navigation die must remain distinct at24px.
c={};im,_,_=native(Image.open(P/'candidates/item_nav_chip_generated.png').convert('RGBA'),'nav_chip',False)
for y in range(24):
 for x in range(24):
  p=im.getpixel((x,y));h='#'+''.join(f'{v:02X}'for v in p[:3])
  edge=any(not(0<=x+dx<24 and 0<=y+dy<24)or not im.getpixel((x+dx,y+dy))[3]for dx,dy in[(-1,0),(1,0),(0,-1),(0,1)])
  if p[3]and edge and h in ['#A66B55','#CE8B60','#DF8C86']:c[x,y]='#F4C785'
for x,y,color in [(11,9,'#8B6AAA'),(11,10,'#8ECFCF'),(12,10,'#B7E6DC'),(10,10,'#665589'),(11,11,'#8B6AAA')]:c[x,y]=color
c.update({(11,18):'#F4C785',(12,18):'#F4C785',(11,19):'#CE8B60',(12,19):'#CE8B60',(13,19):None})
save('nav_chip',c)
# Turbine ring/hub and four broad blades, retaining the actual broken pipe/rust.
c={}
for x,y in[(6,16),(7,16)]:c[x,y]='#F4C785'
c[6,15]='#FFE0A6'
for x,y in[(7,13),(7,14),(9,15),(9,16),(8,18),(5,15)]:c[x,y]='#687C8B'
for x,y in[(8,14),(10,15),(7,17),(4,16)]:c[x,y]='#9B83AB'
for x,y in[(5,12),(4,13)]:c[x,y]='#D5C7D7'
c[14,2]='#CE8B60';c[14,3]='#242039';c[16,8]='#F4C785'
save('broken_engine',c)
# A clean pale face and one immediately legible medical plus, not a pink blur.
c={(x,y):'#D5C7D7'for y in range(11,18)for x in range(8,15)}
for y in range(11,17):
 for x in range(10,12):c[x,y]='#BD6570'
for y in range(13,15):
 for x in range(8,14):c[x,y]='#BD6570'
c[10,11]='#DF8C86';c[11,11]='#DF8C86'
save('medkit',c)
# The jerrycan's warm front, gold droplet and handle differ from an energy cell.
c={(x,y):'#A66B55'for y in range(11,19)for x in range(8,14)}
for y in range(9,19):c[7,y]='#CE8B60'
for x in range(10,15):c[x,2]='#F4C785'
for x,y in[(10,12),(9,13),(10,13),(9,14),(10,14),(11,14),(8,15),(9,15),(10,15),(11,15),(9,16),(10,16),(11,16),(10,17)]:c[x,y]='#F4C785'
c[10,12]='#FFE0A6';c[9,14]='#FFE0A6';c[7,5]='#D5C7D7'
save('fuel_can',c)
# Three crystal facets below a short glass arc, above a scientific cyan base.
c={}
def poly(points,color):
 m=Image.new('1',(24,24));ImageDraw.Draw(m).polygon(points,fill=1)
 for y in range(24):
  for x in range(24):
   if m.getpixel((x,y)):c[x,y]=color
poly([(11,6),(12,7),(12,10),(11,12),(10,13),(9,11),(10,8)],'#8B6AAA')
poly([(15,10),(16,9),(16,12),(14,14),(13,13)],'#8B6AAA')
poly([(6,10),(7,11),(8,13),(7,14),(6,12)],'#8B6AAA')
for x,y in[(11,7),(10,9),(10,10),(15,11),(14,12),(6,11)]:c[x,y]='#B39AC7'
for x,y in[(12,8),(12,9),(11,11),(15,13),(7,13)]:c[x,y]='#665589'
for x,y in[(11,6),(5,7),(6,6),(7,5),(8,4)]:c[x,y]='#F2EDF4'
for x in range(5,18):c[x,16]='#F4C785'
c[18,15]='#F4C785';c[19,15]='#FFE0A6'
for x in range(10,14):c[x,18]='#8ECFCF'
save('sample',c)
# A broad blue toolbox, two gold latches and a single native-grid wrench glyph.
c={(x,y):'#495569'for y in range(13,18)for x in range(5,16)}
for x in range(9,15):c[x,4]='#F4C785'
c[11,4]='#FFE0A6';c[8,5]='#CE8B60';c[15,5]='#CE8B60'
for x,y in[(7,11),(7,12),(14,11),(14,12)]:c[x,y]='#F4C785'
for x,y in[(7,13),(8,13),(6,14),(8,14),(7,15),(8,15),(9,15),(10,15),(11,16),(12,16),(13,16),(13,15),(12,14)]:c[x,y]='#F4C785'
c[7,13]='#FFE0A6';c[12,15]='#495569'
save('toolbox',c)
(P/'pixel-edits.json').write_text(json.dumps(edits,indent=2)+'\n')
