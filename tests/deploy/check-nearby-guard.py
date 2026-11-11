"""Exercise the deployment guard against the actual old/current SQL definitions."""
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
script = (root / 'deploy/wsl/apply-migrations.sh').read_text()
guard = script[script.index('NEARBY_DEF='):script.index('\necho "OK')]
old = (root / 'supabase/migrations/20261111172711_manual_checkin_and_ugc_safety.sql').read_text()
current = (root / 'supabase/migrations/20261111190027_configurable_checkin_duration.sql').read_text()

def check(sql, success):
    result = subprocess.run(['bash', '-c', 'set -euo pipefail\npsql_run() { printf "%s" "$TEST_NEARBY_DEF"; }\n' + guard], env={**os.environ, 'TEST_NEARBY_DEF': sql}, capture_output=True, text=True)
    assert (result.returncode == 0) == success, result.stderr

check(current, True)
check(old, False)
check(current.replace('AND ci.expires_at > now()', ''), False)
check(current.replace('ST_MakePoint(ci.lng, ci.lat)', 'ST_MakePoint(l.lng, l.lat)'), False)
check(current.replace('least(coalesce(myaccuracy, 0), 100)', '0'), False)
check('', False)
print('PASS: current schema accepted; legacy rules, missing expiry/snapshot/accuracy guards and empty schema rejected')
