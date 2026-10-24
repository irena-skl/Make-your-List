"""生成模拟封面 PNG（青色渐变 + 播放三角），用于沙箱内路由 img.youtube.com"""
import zlib, struct

W, H = 640, 360

def chunk(typ, data):
    c = typ + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

rows = []
for y in range(H):
    row = bytearray([0])  # filter: none
    for x in range(W):
        t = x / W * 0.55 + y / H * 0.45
        r = int(14 + (34 - 14) * t)
        g = int(116 + (211 - 116) * t)
        b = int(144 + (238 - 144) * t)
        dx, dy = abs(x - W // 2), abs(y - H // 2)
        if dy < 52 and dx < 60 and dx * 1.15 + dy * 1.0 < 74:
            r, g, b = 255, 255, 255
        row += bytes((r, g, b))
    rows.append(bytes(row))

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
png += chunk(b'IEND', b'')

with open('C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player/.verify/mock-cover.png', 'wb') as f:
    f.write(png)
print('mock-cover.png written,', len(png), 'bytes')
