import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FlatNode } from '../../types';
import { useBasketStore } from '../basketStore';

const makeNode = (overrides: Partial<FlatNode> = {}): FlatNode => ({
    id: 'node-1',
    name: 'File.ts',
    type: 'file',
    path: '/src/File.ts',
    group: 1,
    ...overrides,
});

describe('basketStore', () => {
    beforeEach(() => {
        useBasketStore.setState({
            threads: [],
            activeThreadId: null,
            totalTokens: 0,
            library: [],
        });
    });

    it('creates a thread and updates totals', () => {
        const thread = useBasketStore.getState().createThread(makeNode(), 'ask');
        const state = useBasketStore.getState();

        expect(state.threads).toHaveLength(1);
        expect(state.activeThreadId).toBe(thread.id);
        expect(thread.tokenCount).toBeGreaterThan(0);
        expect(state.totalTokens).toBe(thread.tokenCount);
    });

    it('deletes a thread and recalculates totalTokens', () => {
        const first = useBasketStore.getState().createThread(makeNode({ id: 'node-1' }), 'ask');
        const second = useBasketStore
            .getState()
            .createThread(makeNode({ id: 'node-2', path: '/src/Other.ts' }), 'ask');

        useBasketStore.getState().deleteThread(first.id);

        const state = useBasketStore.getState();
        expect(state.threads).toHaveLength(1);
        expect(state.threads[0]?.id).toBe(second.id);
        expect(state.totalTokens).toBe(second.tokenCount);
        expect(state.activeThreadId).toBe(second.id);
    });

    it('saves a thread to the library and persists to localStorage', () => {
        const thread = useBasketStore.getState().createThread(makeNode(), 'ask');

        useBasketStore.getState().saveToLibrary(thread.id, 'Minha nota', ['tag']);

        const state = useBasketStore.getState();
        const setItemMock = localStorage.setItem as unknown as ReturnType<typeof vi.fn>;
        expect(state.library).toHaveLength(1);
        expect(state.library[0]?.id).toBe(thread.id);
        expect(setItemMock).toHaveBeenCalledWith(
            'codemind-thread-library',
            JSON.stringify(state.library)
        );
    });
});
