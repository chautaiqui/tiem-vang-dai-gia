import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newGame, startNextDay, closeDay, openShop } from '../game/logic/game';
import { clearSave, loadGame, saveGame } from './save';

describe('IndexedDB save', () => {
  it('round-trips a game and clears it', async () => {
    let g = newGame(77);
    g = startNextDay(closeDay(openShop(g)).state);
    await saveGame(g);
    expect(await loadGame()).toEqual(g);
    await clearSave();
    expect(await loadGame()).toBeNull();
  });

  it('ignores saves from another version', async () => {
    await saveGame({ ...newGame(1), version: 999 });
    expect(await loadGame()).toBeNull();
  });
});
