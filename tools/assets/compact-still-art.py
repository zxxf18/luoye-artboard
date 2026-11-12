"""Stage smaller WebP originals for colored backgrounds and static stickers."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import subprocess

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
CATALOGS = ('public/assets/catalog.json', 'resources/assets/legacy-catalog.json')
LUMA = np.array([.299, .587, .114], dtype=np.float32)


def still_art_paths():
    selected, protected = set(), set()
    for catalog in CATALOGS:
        for asset in json.loads((ROOT / catalog).read_text(encoding='utf-8')):
            frames = set(asset.get('frames', []))
            for group in asset.get('fairyGroups', []):
                frames.update(group['frames'])
            protected.update(frames)
            protected.add(asset.get('thumbnail'))
            if asset['category'] in ('background', 'sticker') and not (asset.get('coloring') or frames):
                selected.add(asset['src'])
            else:
                protected.add(asset['src'])
    return sorted(path for path in selected - protected if path.endswith('.webp'))


def is_lossy_webp(data):
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        if kind in (b'VP8 ', b'VP8L', b'ANIM'):
            return kind == b'VP8 '
        size = int.from_bytes(data[offset + 4:offset + 8], 'little')
        offset += 8 + size + size % 2
    return False


def blocks(plane):
    height, width = plane.shape
    height, width = height // 8 * 8, width // 8 * 8
    return plane[:height, :width].reshape(height // 8, 8, width // 8, 8)


def similarity(source, candidate):
    before = np.asarray(source, dtype=np.float32)
    after = np.asarray(candidate, dtype=np.float32)
    alpha = before[:, :, 3] / 255
    delta = (before[:, :, :3] - after[:, :, :3]) * alpha[:, :, None]
    mse = np.square(delta).sum() / max(1, 3 * np.square(alpha).sum())
    psnr = float(10 * np.log10(255**2 / max(1e-10, mse)))

    # Score local luminance on a neutral backdrop, excluding transparent margins.
    x = blocks((before[:, :, :3] @ LUMA - 128) * alpha + 128)
    y = blocks((after[:, :, :3] @ LUMA - 128) * alpha + 128)
    axes = (1, 3)
    mx, my = x.mean(axis=axes, keepdims=True), y.mean(axis=axes, keepdims=True)
    dx, dy = x - mx, y - my
    covariance = (dx * dy).mean(axis=axes, keepdims=True)
    vx, vy = np.square(dx).mean(axis=axes, keepdims=True), np.square(dy).mean(axis=axes, keepdims=True)
    score = ((2 * mx * my + 6.5025) * (2 * covariance + 58.5225)
             / ((mx**2 + my**2 + 6.5025) * (vx + vy + 58.5225)))
    visible = score.reshape(x.shape[0], x.shape[2])[blocks(alpha).mean(axis=axes) > .05]
    if not visible.size:
        return psnr, 0., 0.
    return psnr, float(visible.mean()), float(np.quantile(visible, .02))


def compact(relative, source_dir, output_dir, encoder):
    original = (source_dir / relative).read_bytes()
    if len(original) < 64 * 1024 or not is_lossy_webp(original):
        return None
    with Image.open(BytesIO(original)) as image:
        if {'icc_profile', 'exif', 'xmp'}.intersection(image.info) or min(image.size) < 8:
            return None
        reference = image.convert('RGBA')
    encoded = subprocess.run(
        [encoder, '-quiet', '-q', '88', '-m', '6', '-sharp_yuv', '-alpha_q', '100',
         '-alpha_filter', 'best', '-o', '-', '--', '-'],
        input=original, capture_output=True, check=True,
    ).stdout
    if len(encoded) * 100 > len(original) * 95:
        return None
    with Image.open(BytesIO(encoded)) as image:
        candidate = image.convert('RGBA')
    if reference.size != candidate.size or reference.getchannel('A').tobytes() != candidate.getchannel('A').tobytes():
        return None
    psnr, mean, low = similarity(reference, candidate)
    if psnr < 38 or mean < .97 or low < .90:
        return None
    target = output_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encoded)
    return dict(path=relative, before=len(original), after=len(encoded), psnr=psnr, ssim=mean, ssim_p02=low)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--jobs', type=int, default=min(8, os.cpu_count() or 1))
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    encoder = shutil.which('cwebp')
    if not encoder:
        parser.error('cwebp is required')
    if not source.is_dir() or output == source or output.is_relative_to(source):
        parser.error('use an existing source directory and a separate staging directory')
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        parser.error('the staging directory must be empty')
    if args.jobs < 1:
        parser.error('--jobs must be positive')
    output.mkdir(parents=True, exist_ok=True)
    paths = still_art_paths()
    print(f'Checking {len(paths)} still images', flush=True)
    accepted = []
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        results = executor.map(lambda relative: compact(relative, source, output, encoder), paths)
        for count, result in enumerate(results, 1):
            if result is not None:
                accepted.append(result)
            if count % 200 == 0:
                print(f'Checked {count}/{len(paths)}', flush=True)
    (output / 'report.json').write_text(json.dumps(accepted, indent=2) + '\n', encoding='utf-8')
    saved = sum(item['before'] - item['after'] for item in accepted)
    print(f'{len(accepted)} candidates, {saved / 2**20:.1f} MiB saved')


if __name__ == '__main__':
    main()
