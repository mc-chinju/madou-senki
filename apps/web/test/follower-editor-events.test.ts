import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { FollowerInputView } from '../src/game/follower-input.js';

const stateHarness = vi.hoisted(() => ({
  updaters: [] as Array<(value: string[]) => string[]>,
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: string[]) => [initial, (next: string[] | ((value: string[]) => string[])) => {
      if (typeof next === 'function') stateHarness.updaters.push(next);
    }],
  };
});

const { FollowerEditor } = await import('../src/game/FollowerEditor.js');

function input(): FollowerInputView {
  return {
    self: {
      id: 'A',
      hand: ['a2-p19-r1c3'],
      followers: [{ cardInstanceId: 'a2-p21-r2c1' }],
      stats: { followerLimit: 2 },
    },
    legalChoices: ['ARRANGE_FOLLOWERS'],
    activeWindow: null,
    followerPlacementOptions: {
      placeableCardInstanceIds: ['a2-p19-r1c3'],
      removableCardInstanceIds: [],
    },
    followerDefenseOptions: [],
  };
}

function elements(node: ReactNode): ReactElement[] {
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  return [node, ...Children.toArray(children).flatMap(elements)];
}

beforeEach(() => { stateHarness.updaters.length = 0; });

test('captures the selected follower before React evaluates the queued state update', () => {
  const view = input();
  const tree = FollowerEditor({ view, disabled: false, confirm: () => {} });
  const select = elements(tree).find(element => element.type === 'select');
  const onChange = (select?.props as { onChange?: (event: { target: { value: string } }) => void }).onChange;
  const event = { target: { value: 'a2-p19-r1c3' } };

  onChange?.(event);

  expect(event.target.value).toBe('');
  expect(stateHarness.updaters).toHaveLength(1);
  expect(stateHarness.updaters[0]!(view.self.followers.map(card => card.cardInstanceId))).toEqual([
    'a2-p21-r2c1',
    'a2-p19-r1c3',
  ]);
});
