"""Generate the two built-in paper grains without external artwork."""

from pathlib import Path
from random import Random

from PIL import Image, ImageChops, ImageFilter


output = Path(__file__).resolve().parents[1] / "public" / "assets"
for index, cell_size in enumerate((128, 64)):
    random = Random(24841 + index)
    fine = Image.frombytes("L", (256, 256), bytes(random.randrange(145, 256) for _ in range(256**2)))
    coarse = Image.frombytes("L", (cell_size, cell_size),
                             bytes(random.randrange(155, 256) for _ in range(cell_size**2)))
    coarse = coarse.resize(fine.size, Image.Resampling.BICUBIC)
    grain = ImageChops.multiply(fine, coarse).filter(ImageFilter.GaussianBlur(0.45))
    grain.convert("RGB").save(output / f"grain-{index}.png", optimize=True)
