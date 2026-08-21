import { beforeEach, vi } from 'vitest';

const storage = new Map<string, string>();

const localStorageMock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
        storage.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
        storage.delete(key);
    }),
    clear: vi.fn(() => {
        storage.clear();
    }),
};

vi.stubGlobal('localStorage', localStorageMock as unknown as Storage);

beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
});
