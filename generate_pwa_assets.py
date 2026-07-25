import struct
import zlib
from pathlib import Path

root = Path(__file__).resolve().parent
(root / 'icons').mkdir(exist_ok=True)
(root / 'screenshots').mkdir(exist_ok=True)


def write_png(path: Path, width: int, height: int, fill_color: tuple[int, int, int, int], accent_color: tuple[int, int, int, int] | None = None) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            if accent_color is not None and x in range(width // 4, width * 3 // 4) and y in range(height // 4, height * 3 // 4):
                color = accent_color
            else:
                color = fill_color
            raw.extend(color)
    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    png.extend(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)))
    png.extend(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b'IEND', b''))
    path.write_bytes(png)


write_png(root / 'icons' / 'icon-192.png', 192, 192, (31, 41, 55, 255), (79, 70, 229, 255))
write_png(root / 'icons' / 'icon-512.png', 512, 512, (31, 41, 55, 255), (79, 70, 229, 255))

# Simple screenshots
write_png(root / 'screenshots' / 'desktop.png', 1280, 720, (245, 248, 250, 255))
write_png(root / 'screenshots' / 'mobile.png', 390, 844, (245, 248, 250, 255))
print('Generated PWA PNG assets')
