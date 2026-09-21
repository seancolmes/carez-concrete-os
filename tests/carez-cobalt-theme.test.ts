import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('app/globals.css', 'utf8');

function block(selector: string) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, selector + ' block is missing');
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  assert.ok(open >= 0 && close > open, selector + ' block is incomplete');
  return css.slice(open + 1, close);
}

function expectToken(source: string, token: string, value: string) {
  assert.ok(source.includes('--' + token + ': ' + value + ';'), '--' + token + ' must be ' + value);
}

test('light theme implements the approved Carez Cobalt semantic contract', () => {
  const root = block(':root');
  for (const [token, value] of Object.entries({
    'surface-canvas':'#F7F9FC',
    'surface-panel':'#FFFFFF',
    'surface-raised':'#EDF3F8',
    'text-primary':'#172131',
    'text-secondary':'#34495E',
    'text-muted':'#516477',
    'border-default':'#C4D0DC',
    'border-strong':'#6D8196',
    'interaction-primary':'#0047AB',
    'interaction-strong':'#000080',
    'interaction-selection':'#E3F1FA',
    'interaction-focus':'#0047AB',
    'spatial-accent':'#82C8E5',
    'spatial-muted':'#6D8196',
    'status-success':'#087F5B',
    'status-warning':'#A86100',
    'status-error':'#C73838',
    'status-info':'#0047AB',
  })) expectToken(root, token, value);
});

test('dark theme implements the approved Carez Cobalt semantic contract', () => {
  const dark = block('.dark');
  for (const [token, value] of Object.entries({
    'surface-canvas':'#0F1722',
    'surface-panel':'#162331',
    'surface-raised':'#1D2C3B',
    'text-primary':'#EAF2F8',
    'text-secondary':'#C9D6E2',
    'text-muted':'#B7C6D4',
    'border-default':'#2C4358',
    'border-strong':'#6D8196',
    'interaction-primary':'#82C8E5',
    'interaction-strong':'#0047AB',
    'interaction-selection':'#183A63',
    'interaction-focus':'#82C8E5',
    'spatial-accent':'#82C8E5',
    'spatial-muted':'#6D8196',
    'status-success':'#4DFFBC',
    'status-warning':'#FFC857',
    'status-error':'#FF4D4D',
    'status-info':'#82C8E5',
  })) expectToken(dark, token, value);
});
