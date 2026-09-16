import cv2
import numpy as np

img = cv2.imread(r"C:\Users\MOON\Desktop\dianzi-muyu\assets\ref-clip\frame-032.png")
h, w = img.shape[:2]
x0, x1 = int(w * 0.38), int(w * 0.62)
roi = img[:, x0:x1]
hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
mask = cv2.inRange(hsv, (5, 40, 30), (25, 200, 160))
mask = cv2.medianBlur(mask, 7)
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
blobs = []
for c in cnts:
    area = cv2.contourArea(c)
    if area < 800:
        continue
    (x, y), r = cv2.minEnclosingCircle(c)
    if r < 28 or r > 70:
        continue
    blobs.append((int(x + x0), int(y), int(r), int(area)))
blobs.sort(key=lambda b: b[1])
print("blobs", len(blobs))
for b in blobs:
    print(b)

good = [b for b in blobs if 40 <= b[2] <= 58 and 300 < b[1] < 900]
print("good", good)
if not good:
    raise SystemExit("no bead")

x, y, r, _ = good[min(2, len(good) - 1)]
visible = r - 5
pad = visible + 3
crop = img[y - pad : y + pad, x - pad : x + pad]
ch = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
yy, xx = np.ogrid[: ch.shape[0], : ch.shape[1]]
cx = cy = pad
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
ch[..., 3] = np.clip((visible - dist) * 255 / 1.8, 0, 255).astype(np.uint8)
out = r"C:\Users\MOON\Desktop\dianzi-muyu\assets\bead-one.png"
cv2.imwrite(out, ch)
print("wrote", ch.shape, "center", x, y, r)
