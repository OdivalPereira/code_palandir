import { useSyncExternalStore } from 'react';

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;
type Subscribe = (listener: () => void) => () => void;
type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

type StoreHook<T> = {
  <U>(selector: (state: T) => U): U;
  getState: GetState<T>;
  setState: SetState<T>;
};

export const create = <T>(createState: StateCreator<T>): StoreHook<T> => {
  let state = createState(setState, getState);
  const listeners = new Set<() => void>();

  function setState(partial: Partial<T> | ((state: T) => Partial<T>), replace = false) {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    state = replace ? (nextState as T) : { ...state, ...nextState };
    listeners.forEach(listener => listener());
  }

  function getState() {
    return state;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useStore<U>(selector: (state: T) => U) {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  }

  useStore.getState = getState;
  useStore.setState = setState;

  return useStore;
};
