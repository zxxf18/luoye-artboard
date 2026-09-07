// Native clients load drawing bitmaps on demand; browsers use their same origin.
export async function canvasAssets() { return 'window.LUOYE_IMAGE_DATA = {};\n'; }
