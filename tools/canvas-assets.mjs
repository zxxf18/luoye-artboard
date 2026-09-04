// Native clients load drawing bitmaps on demand; browsers use their same origin.
export async function canvasAssets() { return 'window.JSHW_IMAGE_DATA = {};\n'; }
