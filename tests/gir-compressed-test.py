import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from gir_format import parse_gir
class CompleteGIR(unittest.TestCase):
    def test_all_154_containers_decode_without_trailing_bytes(self):
        files=list(Path('jshw/glib/girl').rglob('*.gir'))
        self.assertEqual(len(files),154)
        for path in files:
            with self.subTest(path=path):
                value=parse_gir(path.read_bytes())
                for group in value['groups']:
                    for frame in group['frames']:
                        self.assertTrue(all(x+n<=frame['width'] and y<frame['height'] for x,y,n,a in frame['runs']))
    def test_compressed_rgb_covers_every_pixel(self):
        value=parse_gir(Path('jshw/glib/girl/2/03.gir').read_bytes())
        frames=[f for g in value['groups'] for f in g['frames'] if 'rgb_runs' in f]
        self.assertGreater(len(frames),0)
        for f in frames:self.assertEqual(sum(r[2] for r in f['rgb_runs']),f['width']*f['height'])
if __name__=='__main__':unittest.main()
