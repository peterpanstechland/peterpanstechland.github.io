from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import pair_indicator as pairing


class PairingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'config.local.h'
        self.target = Path(self.temp.name) / 'local_config.h'
        self.source.write_text('#define ROBO_DEVICE_TOKEN "test-only-device-token"\n#define ROBO_WIFI_STA 1\n#define ROBO_STA_SSID "Office"\n#define ROBO_STA_PASSWORD "test-only-password"\n')
        self.state = {'schema_version': 1, 'device_id': 'RoboPlanter-TEST'}

    def test_single_read_then_write_preserves_other_options(self):
        self.target.write_text('#pragma once\n#define PLANTER_ENABLE_LOCAL_SOIL 1\n#define PLANTER_WATER_DURATION_MS 1000\n#define PLANTER_BASE_URL "http://old.local"\n')
        with patch.object(pairing, 'request', return_value=self.state) as request:
            result = pairing.pair(self.source, self.target, 'http://planter.local/', 'RoboPlanter-TEST', True)
        request.assert_called_once_with('http://planter.local/', 'test-only-device-token')
        self.assertEqual(result, 'RoboPlanter-TEST')
        cfg = pairing.defines(self.target)
        self.assertEqual(cfg['PLANTER_BASE_URL'], 'http://planter.local')
        self.assertEqual(cfg['PLANTER_WIFI_SSID'], 'Office')
        self.assertEqual(cfg['PLANTER_ENABLE_LOCAL_SOIL'], 1)
        self.assertEqual(cfg['PLANTER_WATER_DURATION_MS'], 1000)

    def test_mismatched_device_does_not_modify_config(self):
        self.target.write_text('// preserve this\n')
        with patch.object(pairing, 'request', return_value=self.state):
            with self.assertRaises(ValueError):
                pairing.pair(self.source, self.target, 'http://planter.local', 'RoboPlanter-OTHER', True)
        self.assertEqual(self.target.read_text(), '// preserve this\n')

    def test_existing_config_requires_explicit_replace_before_network(self):
        self.target.write_text('// private\n')
        with patch.object(pairing, 'request') as request:
            with self.assertRaises(ValueError):
                pairing.pair(self.source, self.target, 'http://planter.local')
        request.assert_not_called()

    def test_ap_ssid_uses_verified_device_id(self):
        self.source.write_text('#define ROBO_DEVICE_TOKEN "test-only-device-token"\n')
        with patch.object(pairing, 'request', return_value=self.state):
            pairing.pair(self.source, self.target, 'http://192.168.4.1')
        self.assertEqual(pairing.defines(self.target)['PLANTER_WIFI_SSID'], 'RoboPlanter-TEST')

    def test_no_default_token_or_duplicate_defines(self):
        for source in ['#define ROBO_DEVICE_TOKEN "change-me-before-use"\n',
                       '#define ROBO_WIFI_STA 0\n#define ROBO_WIFI_STA 1\n']:
            self.source.write_text(source)
            with patch.object(pairing, 'request') as request:
                with self.assertRaises(ValueError):
                    pairing.pair(self.source, self.target, 'http://planter.local')
            request.assert_not_called()
            self.assertFalse(self.target.exists())

    def test_failure_does_not_echo_server_body_or_credential(self):
        import contextlib
        import io
        output = io.StringIO()
        with patch.object(pairing, 'request', side_effect=RuntimeError('secret-response-body')):
            with contextlib.redirect_stderr(output):
                result = pairing.main(['--url', 'http://planter.local', '--xiao-config', str(self.source), '--output', str(self.target)])
        self.assertEqual(result, 1)
        self.assertNotIn('secret-response-body', output.getvalue())
        self.assertNotIn('test-only-device-token', output.getvalue())
        self.assertFalse(self.target.exists())


if __name__ == '__main__':
    unittest.main()
