#!/usr/bin/env python3
"""Local Tripo CLI runner. No API keys are read, logged, embedded, or sent to ChatGPT.
Default: inspect the plan without network access or credits. --execute starts real work.
Official command contract: https://developers.tripo3d.ai/en/docs/cli
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temp, path)


def confined_file(relative: str) -> Path:
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError('Manifest file paths must stay inside this package.')
    if not path.is_file():
        raise ValueError(f'Missing input: {relative}')
    return path


def load_plan(only: str | None) -> list[dict[str, Any]]:
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    assets = manifest['assets']
    known = {a['id'] for a in assets}
    if len(known) != len(assets):
        raise ValueError('Duplicate asset IDs.')
    wanted = set(only.split(',')) if only else known
    if wanted - known:
        raise ValueError('Unknown IDs: ' + ', '.join(sorted(wanted - known)))
    selected = [a for a in assets if a['id'] in wanted]
    for a in selected:
        if not re.fullmatch(r'[a-z0-9_]+', a['id']):
            raise ValueError('Unsafe asset ID.')
        if a['mode'] not in ('image', 'text'):
            raise ValueError('Unknown generation mode.')
        confined_file(a['reference'])
        prompt = confined_file(a['prompt_file']).read_text(encoding='utf-8').strip()
        if not prompt:
            raise ValueError(f'Empty prompt: {a["id"]}')
    return selected


def fingerprint(a: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    digest.update(json.dumps(a, sort_keys=True, ensure_ascii=False).encode())
    for field in ('reference', 'prompt_file'):
        digest.update(confined_file(a[field]).read_bytes())
    return digest.hexdigest()


def cli_command() -> list[str]:
    for name in (('tripo.cmd', 'tripo') if os.name == 'nt' else ('tripo',)):
        found = shutil.which(name)
        if found:
            return [found]
    # npx executes the officially documented tripo-cli package locally; it does not
    # change the user's global npm installation or Windows execution policy.
    npx = shutil.which('npx.cmd' if os.name == 'nt' else 'npx')
    if npx:
        return [npx, '--yes', '--package=tripo-cli', 'tripo']
    raise RuntimeError('Node.js/npx or Tripo CLI is missing. Install Node.js 20+ locally, then run again.')


def validate_glb(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError('Too short to be a GLB.')
    magic, version, total = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or total != len(data):
        raise ValueError('Invalid GLB header, version or byte length.')
    chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
    if chunk_type != 0x4E4F534A or 20 + chunk_len > len(data):
        raise ValueError('First GLB chunk is not valid JSON.')
    document = json.loads(data[20:20+chunk_len].decode('utf-8').rstrip(' \x00'))
    if not document.get('meshes') or not document.get('nodes'):
        raise ValueError('No mesh/nodes in this GLB.')
    return {
        'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'meshes': len(document['meshes']), 'nodes': len(document['nodes']),
        'materials': len(document.get('materials', [])),
        'images': len(document.get('images', [])),
        'node_names': [n.get('name', '') for n in document['nodes']],
        'structurally_valid': True,
        'visual_qa_passed': False,
        'note': 'Container/header checks only. This does not certify topology, pivots, texture fidelity or working animations.'
    }


def make_command(cli: list[str], a: dict[str, Any], out: Path) -> list[str]:
    arg = (str(confined_file(a['reference'])) if a['mode'] == 'image'
           else confined_file(a['prompt_file']).read_text(encoding='utf-8').strip())
    # A supplemental text prompt is intentionally NOT passed for image-to-model.
    # No undocumented --prompt or rigging parameters are invented.
    return cli + ['make', arg, '--name', a['id'], '--out', str(out),
                  '--param', 'texture=true', '--param', 'pbr=true',
                  '--param', 'texture_quality=detailed']


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--execute', action='store_true', help='Authenticate and submit real paid Tripo generation jobs.')
    p.add_argument('--only', help='Comma-separated exact asset IDs. Default: all 13.')
    p.add_argument('--approve-count', type=int, help='Noninteractive approval of exactly N new submissions.')
    p.add_argument('--out', type=Path, default=ROOT/'output', help='Local result directory, never the blog repository.')
    args = p.parse_args(argv)
    assets = load_plan(args.only)
    out = args.out.expanduser().resolve()
    state_path = out/'runner_state.json'
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'project':'Maker Garage', 'assets':{}}
    pending: list[dict[str, Any]] = []
    for a in assets:
        old = state['assets'].get(a['id'])
        if old:
            if old.get('input_fingerprint') != fingerprint(a):
                raise RuntimeError(f'{a["id"]}: inputs changed; choose a new --out folder rather than overwriting this run.')
            if old.get('status') == 'downloaded_needs_visual_qa':
                saved = old.get('glb_reports', [])
                if saved and all(Path(x['path']).exists() for x in saved):
                    print(f'SKIP {a["id"]}: existing output retained.')
                    continue
            raise RuntimeError(f'{a["id"]}: prior submission requires review; no automatic resubmission. Inspect its task.json and run tripo history to avoid duplicate charges.')
        pending.append(a)
    print(f'Planned new model submissions: {len(pending)}')
    for a in pending:
        print(f'  {a["id"]:23} {a["mode"]:5} {a["title"]} | reference {a["reference_size_px"]}')
    print('\nThese are low-resolution concept references, not guaranteed production assets.\nBrand portrait is NOT submitted; profile-frame job generates an empty centre.\nNo output will be published or deployed automatically.')
    if not args.execute:
        print('\nDRY RUN: no network, login, uploads, submissions or credit spending.\nTo execute locally: python run_tripo.py --execute')
        return 0
    if not pending:
        print('Nothing new to generate.')
        return 0
    if args.approve_count is None:
        if not sys.stdin.isatty():
            raise RuntimeError('A terminal or explicit --approve-count N is required for credit-spending approval.')
        expected = f'GENERATE {len(pending)}'
        text = input(f'Generating may consume Tripo credits. To approve these {len(pending)} jobs type {expected}: ')
        if text.strip() != expected:
            print('Cancelled; no tasks submitted.')
            return 0
    elif args.approve_count != len(pending):
        raise RuntimeError('--approve-count does not match the number of new jobs; nothing submitted.')
    cli = cli_command()
    # Check auth without publishing credential-bearing or identity output into logs.
    auth = subprocess.run(cli+['whoami','--json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          text=True, encoding='utf-8', errors='replace', timeout=180)
    if auth.returncode:
        print('Complete the official Tripo browser login locally. Never paste API keys into chat.')
        if subprocess.run(cli+['login'], check=False).returncode:
            raise RuntimeError('Tripo login did not complete. Nothing submitted.')
    if subprocess.run(cli+['doctor'], check=False).returncode:
        raise RuntimeError('Tripo health check failed. Nothing submitted.')
    out.mkdir(parents=True, exist_ok=True)
    for a in pending:
        dest = out/a['id']
        dest.mkdir(parents=True, exist_ok=True)
        if any(dest.iterdir()):
            raise RuntimeError(f'Refusing to write into a nonempty untracked directory: {dest}')
        record = {'status':'submission_started', 'input_fingerprint':fingerprint(a),
                  'mode':a['mode'], 'started_at':now(), 'qa_approved':False}
        state['assets'][a['id']] = record
        atomic_json(state_path,state)
        print(f'\n=== {a["id"]} / {a["title"]} ===', flush=True)
        # CLI blocks until task/download completion. Do not add retries or a second poller.
        try:
            result = subprocess.run(make_command(cli,a,dest), check=False)
        except (KeyboardInterrupt, OSError):
            record.update(status='submission_or_download_interrupted', stopped_at=now())
            atomic_json(state_path,state)
            raise
        record['cli_exit_code']=result.returncode
        record['finished_at']=now()
        if result.returncode:
            record['status']='provider_or_network_error_review_required'
            atomic_json(state_path,state)
            raise RuntimeError('Tripo CLI did not finish successfully. Review task history before resubmitting; remaining jobs were not started.')
        reports=[]
        for model in sorted(dest.rglob('*.glb')):
            reports.append(validate_glb(model))
        if not reports:
            record['status']='no_valid_glb_review_required'
            atomic_json(state_path,state)
            raise RuntimeError('CLI completed but no GLB found. Keep its outputs and inspect task.json; do not rename another format to .glb.')
        record.update(status='downloaded_needs_visual_qa',glb_reports=reports)
        atomic_json(dest/'qa_report.json',{'asset':a['id'],'targets':a['expected_nodes_after_blender'],'glbs':reports,'visual_qa_passed':False})
        atomic_json(state_path,state)
    print('\nDownloaded outputs are ready for visual review, not auto-approved for the website.')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print('\nStopped. A provider task may still be running; inspect Tripo history before retrying.',file=sys.stderr)
        raise SystemExit(130)
    except (RuntimeError,ValueError,KeyError,OSError,subprocess.SubprocessError) as err:
        message=re.sub(r'tsk_[A-Za-z0-9_\-]+','[REDACTED]',str(err))
        print('ERROR: '+message,file=sys.stderr)
        raise SystemExit(1)
