// Shared by the music box and tool feedback; legacy sound choices remain valid.
export function createAudioPreferences(trackCount, storage) {
  if (!storage) { try { storage = globalThis.localStorage; } catch {} }
  const read = key => { try { return storage?.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, value); } catch {} };
  let saved;
  try { saved = JSON.parse(read('luoye-music-settings')); } catch {}
  const music = {
    index: Number.isInteger(saved?.index) && saved.index >= 0 && saved.index < trackCount ? saved.index : 0,
    volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1 ? saved.volume : .35,
    playing: typeof saved?.playing === 'boolean' ? saved.playing : true,
  };
  let sounds = read('luoye-ui-sounds') !== 'off';
  let savedSoundVolume;
  try { savedSoundVolume = JSON.parse(read('luoye-ui-sound-volume')); } catch {}
  let soundVolume = typeof savedSoundVolume === 'number' && Number.isFinite(savedSoundVolume) && savedSoundVolume >= 0 && savedSoundVolume <= 1 ? savedSoundVolume : .6;
  return {
    get sounds() { return sounds; },
    get soundVolume() { return soundVolume; },
    get music() { return {...music}; },
    setSounds(enabled) { sounds = !!enabled; write('luoye-ui-sounds', sounds ? 'on' : 'off'); },
    setSoundVolume(value) { if(typeof value !== 'number' || !Number.isFinite(value))return; soundVolume = Math.max(0,Math.min(1,value)); write('luoye-ui-sound-volume', JSON.stringify(soundVolume)); },
    saveMusic(changes) { Object.assign(music, changes); write('luoye-music-settings', JSON.stringify(music)); },
  };
}
