import assert from 'node:assert/strict';
import test from 'node:test';
import { putGithubVariable } from '../.cloudflare/setup-production.mjs';

test('旧ghでもREST APIで未登録Variableを作成し、値はstdinだけで渡す', () => {
  const calls = [];
  putGithubVariable('MAIL_FROM', 'noreply@synthetic.local', {
    probe: () => ({ status: 1, stderr: 'HTTP 404: Not Found' }),
    run: (args, options) => {
      if (args[0] === 'variable') throw new Error('unknown command variable');
      calls.push({ args, options });
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [
    'api',
    '--method',
    'POST',
    'repos/daishiman/kanjo/actions/variables',
    '--input',
    '-',
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.input), {
    name: 'MAIL_FROM',
    value: 'noreply@synthetic.local',
  });
  assert.equal(calls[0].args.join(' ').includes('noreply@synthetic.local'), false);
});

test('既存VariableはPATCHし、読み取り権限エラーでは一切書き込まない', () => {
  const calls = [];
  putGithubVariable('APP_URL', 'https://synthetic.local', {
    probe: () => ({ status: 0 }),
    run: (args) => calls.push(args),
  });
  assert.equal(calls[0][2], 'PATCH');
  assert.equal(calls[0][3], 'repos/daishiman/kanjo/actions/variables/APP_URL');
  assert.throws(
    () =>
      putGithubVariable('APP_URL', 'https://synthetic.local', {
        probe: () => ({ status: 1, stderr: 'HTTP 403: Forbidden' }),
        run: () => assert.fail('権限を確認できない状態で書き込まない'),
      }),
    /確認に失敗/,
  );
});
