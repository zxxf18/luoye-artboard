# Luoye Piano

`Luoye-Piano.sf2` uses piano samples released by Meta Creative Audio under CC0 1.0 Universal. See the accompanying `LICENSE.txt`. The app uses this bank on Windows and iPad.

- Source collection: [Meta Piano at 514c926](https://github.com/facebookincubator/Meta-open-sound/tree/514c926efecdb3c7812bf00eedf8e5c8d61dd681/systems/instruments/meta-piano).
- Conversion: 23 notes from velocity layer 3 of the Ogg previews, verified against upstream `SHA256SUMS`. The generator converts to mono 32 kHz, caps samples at four seconds, fades the tail, and maps the nearest sample to each key. The bank shares the piano across MIDI programs.
- SHA-256 of the distributed bank: `f72165b9fa25549f66beca424cfe284d42b60a4c29c0f33e74caaaea379e5764`.

To regenerate, obtain the source collection at the pinned revision including its `ogg/` directory. Run `python3 tools/prepare-piano-bank.py <collection-directory> native/audio/Luoye-Piano.sf2` with FFmpeg installed. The app build uses the checked-in bank and does not download samples.
