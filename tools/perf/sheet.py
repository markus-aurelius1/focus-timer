"""Tile screenshots into one contact sheet for review.

    python sheet.py <out.png> <columns> <tile-width> <image> [<image> ...]
"""
import sys
from PIL import Image

out, cols, width = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
tiles = []
for path in sys.argv[4:]:
    im = Image.open(path).convert('RGB')
    h = round(im.height * width / im.width)
    tiles.append(im.resize((width, h), Image.LANCZOS))
gap = 16
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
W = cols * width + (cols + 1) * gap
H = sum(max(t.height for t in r) for r in rows) + (len(rows) + 1) * gap
sheet = Image.new('RGB', (W, H), (120, 120, 120))
y = gap
for r in rows:
    x = gap
    for t in r:
        sheet.paste(t, (x, y))
        x += width + gap
    y += max(t.height for t in r) + gap
sheet.save(out)
print(out, sheet.size)
