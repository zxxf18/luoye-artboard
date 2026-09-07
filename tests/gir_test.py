import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('gir_format',ROOT/'tools/gir_format.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class GirTests(unittest.TestCase):
    def test_six_representative_containers(self):
        for kind in range(3):
            for number in range(2):
                with self.subTest(kind=kind,number=number):
                    raw=(ROOT/f'jshw/glib/girl/{kind}/{number:02}.gir').read_bytes()
                    value=module.parse_gir(raw)
                    self.assertGreater(len(value['groups']),0)
                    for group in value['groups']:
                        self.assertGreater(len(group['frames']),0)
                        self.assertTrue(all(frame['x']+frame['width']<=group['width'] for frame in group['frames']))
    def test_truncation_and_invalid_alpha(self):
        raw=(ROOT/'jshw/glib/girl/0/00.gir').read_bytes()
        with self.assertRaises(ValueError):module.parse_gir(raw[:-1])
        changed=bytearray(raw);changed[0]=0
        with self.assertRaises(ValueError):module.parse_gir(changed)
        # First alpha tuple's opacity is uint16; values above 255 must not wrap.
        changed=bytearray(raw);changed[12556+284+7]=1
        with self.assertRaises(ValueError):module.parse_gir(changed)

if __name__=='__main__':unittest.main()
