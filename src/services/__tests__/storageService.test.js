import { jest } from '@jest/globals';

// Mock the whole supabaseClient module first
jest.unstable_mockModule('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    }
  },
  getAccessToken: jest.fn(),
  default: {
    from: jest.fn(),
    auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    }
  }
}));

// Now import the service we want to test
const { resetOnboarding, isOnboardingComplete, completeOnboarding } = await import('../storageService');

describe('storageService onboarding', () => {
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = (function() {
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
        }),
        key: jest.fn(),
        get length() {
            return Object.keys(store).length;
        }
      };
    })();

    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('completeOnboarding sets value in storage', () => {
    completeOnboarding();
    expect(localStorage.setItem).toHaveBeenCalledWith('bolo_onboarding_complete', 'true');
  });

  test('isOnboardingComplete returns true if set', () => {
    localStorage.setItem('bolo_onboarding_complete', 'true');
    expect(isOnboardingComplete()).toBe(true);
  });

  test('isOnboardingComplete returns false if not set', () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  test('resetOnboarding removes value from storage', () => {
    localStorage.setItem('bolo_onboarding_complete', 'true');
    resetOnboarding();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bolo_onboarding_complete');
    expect(isOnboardingComplete()).toBe(false);
  });
});
