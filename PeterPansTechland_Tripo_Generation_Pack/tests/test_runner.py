from __future__ import annotations
import json, struct, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import run_tripo as r

class Tests(unittest.TestCase):
    def test_asset_count_and_distinct_zones(self):
        items=r.load_plan(None)
        self.assertEqual(len(items),13)
        self.assertTrue(any(x['id']=='06_showcase_zone' for x in items))
        self.assertTrue(any(x['id']=='07_tools_zone' for x in items))
    def test_unknown_selection_rejected(self):
        with self.assertRaises(ValueError): r.load_plan('not_an_asset')
    def test_confined_paths(self):
        with self.assertRaises(ValueError): r.confined_file('../outside.txt')
    def test_profile_does_not_upload_fake_portrait(self):
        a=r.load_plan('03_profile_sign')[0]
        self.assertEqual(a['mode'],'text')
        args=r.make_command(['tripo'],a,Path('dest'))
        self.assertIn('absolutely no person or face',args[2])
        self.assertNotEqual(args[2],str(r.confined_file(a['reference'])))
    def test_image_mode_no_unsupported_prompt_flag(self):
        a=r.load_plan('04_lucky_cat')[0]
        args=r.make_command(['tripo'],a,Path('dest'))
        self.assertEqual(args[2],str(r.confined_file(a['reference'])))
        self.assertNotIn('--prompt',args)
    def test_fingerprint_stable(self):
        a=r.load_plan('01_garage_shell')[0]
        self.assertEqual(r.fingerprint(a),r.fingerprint(a))
        self.assertEqual(len(r.fingerprint(a)),64)
    def test_non_model_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'bad.glb';p.write_bytes(b'not a model'*8)
            with self.assertRaises(ValueError):r.validate_glb(p)
    def test_structural_glb_still_not_visually_approved(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'mock.glb'
            payload=json.dumps({'asset':{'version':'2.0'},'meshes':[{'primitives':[]}],'nodes':[{'name':'TEST_ONLY','mesh':0}]}).encode()
            payload += b' '*((-len(payload))%4)
            p.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(payload))+struct.pack('<II',len(payload),0x4E4F534A)+payload)
            report=r.validate_glb(p)
            self.assertTrue(report['structurally_valid'])
            self.assertFalse(report['visual_qa_passed'])
    def test_dry_run_cannot_invoke_provider(self):
        with tempfile.TemporaryDirectory() as td,patch('run_tripo.subprocess.run',side_effect=AssertionError('Network not allowed')):
            self.assertEqual(r.main(['--only','04_lucky_cat','--out',td]),0)
    def test_wrong_approval_stops_before_cli(self):
        with tempfile.TemporaryDirectory() as td,patch('run_tripo.cli_command',side_effect=AssertionError('Must not run')):
            with self.assertRaises(RuntimeError):
                r.main(['--only','04_lucky_cat','--out',td,'--execute','--approve-count','2'])
    def test_interrupted_submission_not_replayed(self):
        a=r.load_plan('04_lucky_cat')[0]
        with tempfile.TemporaryDirectory() as td:
            r.atomic_json(Path(td)/'runner_state.json',{'assets':{'04_lucky_cat':{'status':'submission_started','input_fingerprint':r.fingerprint(a)}}})
            with patch('run_tripo.subprocess.run',side_effect=AssertionError('Must not retry')):
                with self.assertRaises(RuntimeError):r.main(['--only','04_lucky_cat','--out',td])

if __name__=='__main__':unittest.main()
