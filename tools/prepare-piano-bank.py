"""Convert the pinned CC0 Meta Piano preview samples into a compact SF2 bank."""

import argparse
from hashlib import sha256
from pathlib import Path
import re
from struct import pack, unpack
from subprocess import check_output


def chunk(tag, data):
    return tag + pack("<I", len(data)) + data + b"\0" * (len(data) % 2)


def list_chunk(tag, *children):
    return chunk(b"LIST", tag + b"".join(children))


def info_string(tag, value):
    data = value.encode("ascii") + b"\0"
    return chunk(tag, data + b"\0" * (len(data) % 2))


def generator(op, value):
    return pack("<HH", op, value & 0xffff)


def make_bank(source):
    checksums = {file: checksum for checksum, file in
                 (line.split() for line in (source / "SHA256SUMS").read_text().splitlines())}
    notes = sorted(set(range(21, 109, 4)) | {108})
    files = {int(key): "ogg/" + file for key, file in re.findall(
        r"key=(\d+) sample=(INSPiano_Vel03_\S+\.ogg)", (source / "meta-piano.sfz").read_text())}
    rate = 32000
    samples = bytearray()
    headers, zones, bags = [], [], []
    for index, note in enumerate(notes):
        relative = files[note]
        file = source / relative
        if sha256(file.read_bytes()).hexdigest() != checksums[relative]:
            raise ValueError(f"Sample checksum mismatch: {relative}")
        audio = check_output(["ffmpeg", "-nostdin", "-v", "error", "-i", str(file), "-ac", "1", "-ar", str(rate),
                              "-t", "4", "-f", "s16le", "-"])
        count = len(audio) // 2
        if count < rate // 10:
            raise ValueError(f"Sample is too short: {relative}")
        # Fade only the tail so any four-second truncation ends at zero.
        tail = min(rate // 5, count)
        last = unpack(f"<{tail}h", audio[-tail * 2:])
        audio = audio[:-tail * 2] + pack(f"<{tail}h", *(round(x * (tail - i - 1) / tail)
                                                        for i, x in enumerate(last)))
        start, end = len(samples) // 2, len(samples) // 2 + count
        samples.extend(audio + bytes(92))
        headers.append(pack("<20sIIIIIBbHH", f"Key {note}".encode(), start, end,
                            start + 8, end - 8, rate, note, 0, 0, 1))
        low = (notes[index - 1] + note) // 2 + 1 if index else 0
        high = (note + notes[index + 1]) // 2 if index + 1 < len(notes) else 127
        bags.append(pack("<HH", len(zones), 0))
        zones.extend((generator(43, low | high << 8), generator(38, -1200),
                      generator(48, 0), generator(53, index)))

    # Imported MIDI can still select any program. Every preset uses the shared piano.
    presets = [(program, 0) for program in range(128)] + [(0, 128)]
    preset_headers = [pack("<20sHHHIII", b"Luoye Piano", program, bank, index, 0, 0, 0)
                      for index, (program, bank) in enumerate(presets)]
    preset_headers.append(pack("<20sHHHIII", b"EOP", 0, 0, len(presets), 0, 0, 0))
    bags.append(pack("<HH", len(zones), 0))
    headers.append(pack("<20sIIIIIBbHH", b"EOS", 0, 0, 0, 0, 0, 0, 0, 0, 0))
    info = list_chunk(b"INFO", chunk(b"ifil", pack("<HH", 2, 1)),
                      info_string(b"isng", "EMU8000"), info_string(b"INAM", "Luoye Piano"),
                      info_string(b"ICMT", "Meta Piano, CC0 1.0, resampled and remapped for Luoye Artboard"))
    sample_data = list_chunk(b"sdta", chunk(b"smpl", samples))
    hydra = list_chunk(
        b"pdta", chunk(b"phdr", b"".join(preset_headers)),
        chunk(b"pbag", b"".join(pack("<HH", index, 0) for index in range(len(presets) + 1))),
        chunk(b"pmod", bytes(10)), chunk(b"pgen", generator(41, 0) * len(presets) + bytes(4)),
        chunk(b"inst", pack("<20sH20sH", b"Piano", 0, b"EOI", len(notes))),
        chunk(b"ibag", b"".join(bags)), chunk(b"imod", bytes(10)),
        chunk(b"igen", b"".join(zones) + bytes(4)), chunk(b"shdr", b"".join(headers)))
    return chunk(b"RIFF", b"sfbk" + info + sample_data + hydra)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.write_bytes(make_bank(args.source))
