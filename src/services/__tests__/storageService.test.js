import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

global.localStorage = localStorageMock;

// Mock Supabase
jest.unstable_mockModule('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    }))
  },
  default: {
     from: jest.fn()
  }
}));

const { getPromptHistory, STORAGE_KEYS } = await import('../storageService.js');

describe('storageService - Local Cache Loading', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('Scenario A: Returns cached prompts when valid JSON exists', async () => {
    const cachedData = [
      { promptId: '1', title: 'Test Prompt' }
    ];
    localStorage.setItem(STORAGE_KEYS.PROMPTS_CACHE, JSON.stringify(cachedData));

    const result = await getPromptHistory(null);

    expect(result).toEqual(cachedData);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PROMPTS_CACHE);
  });

  test('Scenario B: Returns empty array when localStorage is empty', async () => {
    const result = await getPromptHistory(null);

    expect(result).toEqual([]);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PROMPTS_CACHE);
  });

  test('Scenario C: Returns empty array when malformed JSON in localStorage', async () => {
    localStorage.setItem(STORAGE_KEYS.PROMPTS_CACHE, 'invalid json');

    const result = await getPromptHistory(null);

    expect(result).toEqual([]);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PROMPTS_CACHE);
  });

  test('Scenario D: Returns empty array when localStorage.getItem throws', async () => {
    localStorage.getItem.mockImplementationOnce(() => {
      throw new Error('Storage access denied');
    });

    const result = await getPromptHistory(null);

    expect(result).toEqual([]);
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PROMPTS_CACHE);
  });
});
