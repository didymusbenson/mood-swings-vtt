import { describe, expect, it } from 'vitest';
import { AVATAR_POOL, assignAvatars, avatarFor } from './avatars.js';

const roster = [{ id: 'p1' }, { id: 'p2' }];

describe('player avatars (F4a)', () => {
  it('assigns a distinct emoji per player', () => {
    const map = assignAvatars(roster);
    expect(map.p1).toBeTruthy();
    expect(map.p2).toBeTruthy();
    expect(map.p1).not.toBe(map.p2);
  });

  it('is deterministic (same roster → same faces)', () => {
    expect(assignAvatars(roster)).toEqual(assignAvatars(roster));
  });

  it('draws only from the pool, in seat order', () => {
    const map = assignAvatars(roster);
    expect(map.p1).toBe(AVATAR_POOL[0]);
    expect(map.p2).toBe(AVATAR_POOL[1]);
  });

  it('avatarFor agrees with assignAvatars', () => {
    const map = assignAvatars(roster);
    expect(avatarFor(roster, 'p1')).toBe(map.p1);
    expect(avatarFor(roster, 'p2')).toBe(map.p2);
  });

  it('avatarFor falls back to the first face for an unknown id', () => {
    expect(avatarFor(roster, 'nobody')).toBe(AVATAR_POOL[0]);
  });
});
