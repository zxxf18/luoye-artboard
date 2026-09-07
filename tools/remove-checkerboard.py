#!/usr/bin/env python3
"""Remove generated checkerboard previews from assets whose subject touches edges."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def remove_checkerboard(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGBA")
    rgb = np.asarray(image, dtype=np.uint8)[..., :3]
    light = rgb.min(axis=2) >= 205
    neutral = rgb.max(axis=2) - rgb.min(axis=2) <= 18
    candidate = light & neutral
    height, width = candidate.shape
    background = np.zeros((height, width), dtype=np.uint8)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if candidate[y, x] and not background[y, x]:
            background[y, x] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)
    # Frames enclose their preview background, so seed a small center cross too.
    for x in range(width // 2 - 2, width // 2 + 3):
        seed(x, height // 2)
    for y in range(height // 2 - 2, height // 2 + 3):
        seed(width // 2, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and candidate[ny, nx] and not background[ny, nx]:
                background[ny, nx] = 1
                queue.append((nx, ny))

    # Slightly soften the binary cut while keeping the subject fully opaque.
    matte = Image.fromarray((255 - background * 255).astype(np.uint8), "L")
    matte = matte.filter(ImageFilter.GaussianBlur(0.55))
    result = image.copy()
    result.putalpha(matte)
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    remove_checkerboard(args.source, args.destination)


if __name__ == "__main__":
    main()
