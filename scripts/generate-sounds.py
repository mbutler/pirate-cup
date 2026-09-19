"""Generate original nautical effects. Python standard library only; no samples.
Run: python3 scripts/generate-sounds.py
"""
import math
from pathlib import Path
import random
import struct
import wave

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'public/assets/audio'


def render(name, duration, strikes=(), water=0, bells=()):
    rng = random.Random(1729)
    samples = []
    low = 0.0
    for i in range(int(duration * RATE)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low += 0.08 * (noise - low)
        value = 0.0
        for start, strength in strikes:
            age = t - start
            if age >= 0:
                # Damped, inharmonic wooden hull resonances and a short crack.
                for freq, weight in ((93, .6), (173, .3), (287, .18), (431, .08)):
                    value += strength * weight * math.sin(2 * math.pi * freq * age) * math.exp(-age * (9 + freq / 35))
                value += strength * noise * .35 * math.exp(-age * 75)
        if water:
            # A soft rush arriving just after impact, tapering into the water.
            age = max(0, t - .055)
            value += water * (low * 2 + noise * .09) * (1 - math.exp(-age * 24)) * math.exp(-age * 4.5)
        for start, strength in bells:
            age = t - start
            if age >= 0:
                for freq, weight, decay in ((520, .5, 2.8), (1076, .24, 4.5), (1474, .12, 6), (2180, .035, 9)):
                    value += strength * weight * math.sin(2 * math.pi * freq * age) * math.exp(-age * decay) * min(1, age / .003)
        # Short boundary fades avoid clicks, soft saturation leaves headroom.
        fade = min(1, t / .002, (duration - t) / .045)
        samples.append(math.tanh(value) * .7 * fade)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as wav:
        wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', round(x * 32767)) for x in samples))


OUT.mkdir(parents=True, exist_ok=True)
render('hull-impact', .9, ((0, .85), (.045, .35)), water=.65)
render('boarding-clash', .45, ((0, .55), (.085, .35)))
render('ship-wreck', 1.5, ((0, .8), (.13, .55), (.29, .3)), water=1.15)
render('ship-bell', 1.3, bells=((0, .6),))
render('mutiny-bell', 1.5, bells=((0, .55), (.24, .5)))
