import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../workflows/deploy.yml', import.meta.url), 'utf8');

test('deployはAccess設定を対で検証し、その値をWorkerへ渡す', () => {
  assert.match(workflow, /ACCESS_AUD: \$\{\{ vars\.ACCESS_AUD \}\}/);
  assert.match(workflow, /ACCESS_TEAM_DOMAIN: \$\{\{ vars\.ACCESS_TEAM_DOMAIN \}\}/);
  assert.match(workflow, /ACCESS_AUDとACCESS_TEAM_DOMAINは両方設定するか両方空/);
  assert.match(workflow, /--var ACCESS_AUD:"\$ACCESS_AUD"/);
  assert.match(workflow, /--var ACCESS_TEAM_DOMAIN:"\$ACCESS_TEAM_DOMAIN"/);
  assert.doesNotMatch(workflow, /--var ACCESS_(?:AUD|TEAM_DOMAIN):""/);
});
