"""Inpaint the bowl stick and bake wooden one-shot WAVs."""
import os
import wave

import cv2
import numpy as np

ROOT = r"C:\Users\MOON\Desktop\dianzi-muyu"
BOWL = os.path.join(ROOT, "assets", "bowl.png")
SFX = os.path.join(ROOT, "assets", "sfx")
os.makedirs(SFX, exist_ok=True)
SR = 44100


def inpaint_bowl():
    img = cv2.imread(BOWL, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Wooden stick lives on the right: brown, mid value, separated from gold bowl.
    brown = cv2.inRange(hsv, (5, 40, 25), (28, 200, 170))
    right = np.zeros((h, w), np.uint8)
    right[:, int(w * 0.55) :] = 255
    mask = cv2.bitwise_and(brown, right)
    # Grow a little so the stick edge disappears.
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8), iterations=2)
    # Do not eat the gold bowl: clear bright gold pixels from the mask.
    gold = cv2.inRange(hsv, (12, 60, 90), (40, 255, 255))
    gold = cv2.dilate(gold, np.ones((5, 5), np.uint8), iterations=1)
    mask = cv2.bitwise_and(mask, cv2.bitwise_not(gold))
    out = cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)
    # Softly even the inpainted patch toward nearby background.
    bg = img.copy()
    ys, xs = np.where(mask > 0)
    if len(xs):
        x0, x1 = max(0, xs.min() - 8), min(w, xs.max() + 8)
        y0, y1 = max(0, ys.min() - 8), min(h, ys.max() + 8)
        patch = out[y0:y1, x0:x1]
        patch = cv2.GaussianBlur(patch, (7, 7), 0)
        mixed = out.copy()
        mixed[y0:y1, x0:x1] = patch
        m3 = cv2.merge([mask, mask, mask]).astype(np.float32) / 255.0
        out = (mixed.astype(np.float32) * m3 + out.astype(np.float32) * (1 - m3)).astype(np.uint8)
    cv2.imwrite(BOWL, out)
    print("bowl inpainted", BOWL, "mask px", int(mask.sum() / 255))


def write_wav(path, x):
    x = np.clip(x.astype(np.float64), -1, 1)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 0.92
    data = (x * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("wrote", path, "sec", round(len(x) / SR, 3))


def exp_env(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / max(decay, 1e-4))


def damped_sin(n, freq, decay, amp=1.0):
    t = np.arange(n) / SR
    return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)


def hp_noise(n, cutoff, rng):
    x = rng.normal(0, 1, n)
    rc = 1.0 / (2 * np.pi * cutoff)
    a = rc / (rc + 1.0 / SR)
    y = np.zeros(n)
    for i in range(1, n):
        y[i] = a * (y[i - 1] + x[i] - x[i - 1])
    return y


def muyu_hit(rng):
    n = int(SR * 0.22)
    click = hp_noise(n, 1800, rng) * exp_env(n, 0.012) * 0.55
    body = (
        damped_sin(n, 780, 0.028, 0.55)
        + damped_sin(n, 1180, 0.018, 0.38)
        + damped_sin(n, 1640, 0.012, 0.22)
        + damped_sin(n, 2300, 0.008, 0.12)
        + damped_sin(n, 210, 0.035, 0.16)
    )
    # Tiny inharmonic rattle, not a musical glide.
    rattle = hp_noise(n, 2400, rng) * exp_env(n, 0.008) * 0.22
    x = click + body + rattle
    # Fade the last 40ms so loops don't click.
    fade = np.ones(n)
    k = int(0.04 * SR)
    fade[-k:] = np.linspace(1, 0, k)
    return x * fade


def beads_hit(rng):
    n = int(SR * 0.12)
    x = np.zeros(n)

    def tok(offset, amp):
        m = n - offset
        burst = hp_noise(m, 2600, rng) * exp_env(m, 0.007) * amp
        ping = damped_sin(m, 2100, 0.009, 0.22 * amp) + damped_sin(m, 3050, 0.006, 0.12 * amp)
        x[offset:] += burst + ping

    tok(0, 0.9)
    tok(int(0.007 * SR), 0.38)
    fade = np.ones(n)
    k = int(0.02 * SR)
    fade[-k:] = np.linspace(1, 0, k)
    return x * fade


def bowl_hit(rng):
    n = int(SR * 2.1)
    # Strike noise, then long inharmonic metal partials (from the recording ~240/712/1360/2128).
    strike = hp_noise(n, 900, rng) * exp_env(n, 0.03) * 0.18
    parts = [
        (242, 1.65, 0.42),
        (484, 1.15, 0.08),
        (712, 1.25, 0.18),
        (1210, 0.85, 0.07),
        (1360, 0.95, 0.09),
        (2128, 0.55, 0.05),
        (3048, 0.32, 0.025),
    ]
    x = strike.copy()
    t = np.arange(n) / SR
    for f, decay, amp in parts:
        # Slow bloom then decay, like a singing bowl.
        bloom = 1 - np.exp(-t / 0.018)
        x += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / decay) * bloom
    fade = np.ones(n)
    k = int(0.12 * SR)
    fade[-k:] = np.linspace(1, 0, k)
    return x * fade


def main():
    inpaint_bowl()
    rng = np.random.default_rng(7)
    write_wav(os.path.join(SFX, "muyu.wav"), muyu_hit(rng))
    write_wav(os.path.join(SFX, "beads.wav"), beads_hit(rng))
    write_wav(os.path.join(SFX, "bowl.wav"), bowl_hit(rng))


if __name__ == "__main__":
    main()
