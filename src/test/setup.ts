import { beforeEach, vi } from 'vitest';

type LocalStorageMock = {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
};

const storage = new Map<string, string>();

const localStorageMock: LocalStorageMock = {
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
