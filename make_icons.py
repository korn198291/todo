"""Génère les icônes de l'app (PNG, sans dépendance) : carré bleu #346cff.
Usage : python3 make_icons.py   -> web/icon-1024.png (.dmg), icon-512, icon-192, apple-touch-icon"""
import zlib, struct, math, os

BLUE = (0x34, 0x6c, 0xff)  # #346cff
TERRA_TOP, TERRA_BOT = (208, 90, 52), (160, 58, 24)

def seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def rrect(px, py, half, r):  # distance signée d'un carré arrondi centré
    qx, qy = abs(px) - (half - r), abs(py) - (half - r)
    return math.hypot(max(qx, 0), max(qy, 0)) - r + min(max(qx, qy), 0)

def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def cov(d): return max(0.0, min(1.0, 0.5 - d))   # couverture anti-aliasée

def make(N, path, mac=False, full_bleed=False):
    art = 0.805 * N if mac else N                  # grille d'icône macOS : 824/1024
    half, r = art / 2, 0.2237 * art
    R = 0.255 * art                                # rayon du disque
    A, B, C = (-.40 * R, .03 * R), (-.10 * R, .34 * R), (.43 * R, -.30 * R)
    rows = []
    for y in range(N):
        row = bytearray([0])
        for x in range(N):
            px, py = x + .5 - N / 2, y + .5 - N / 2
            a_out, col = 0.0, (0, 0, 0)
            if mac:  # ombre portée douce
                ds = rrect(px, py - 0.012 * N, half, r)
                sh = max(0.0, 1 - max(ds, 0) / (0.03 * N)) * 0.20
                a_out, col = sh, (60, 40, 20)
            d = -1e9 if full_bleed else rrect(px, py, half, r)
            a_bg = cov(d)
            if a_bg > 0:
                t = (py + half) / art
                bg = BLUE
                a_new = a_bg + a_out * (1 - a_bg)
                col = tuple((bg[i] * a_bg + col[i] * a_out * (1 - a_bg)) / a_new for i in range(3))
                a_out = a_new
            row += bytes([int(col[0]), int(col[1]), int(col[2]), int(255 * a_out)])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def ch(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b'')
    open(path, 'wb').write(png)

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
make(1024, os.path.join(d, 'icon-1024.png'), mac=True)
make(512, os.path.join(d, 'icon-512.png'))
make(192, os.path.join(d, 'icon-192.png'))
make(180, os.path.join(d, 'apple-touch-icon.png'), full_bleed=True)  # iOS applique son propre masque
