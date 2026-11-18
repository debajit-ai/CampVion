"use client";

import { useSyncExternalStore } from "react";

export interface AssistantUiState {
  firstMessageSent: boolean;
  isScattering: boolean;
  welcomeCycle: number;
}

let state: AssistantUiState = {
  firstMessageSent: false,
  isScattering: false,
  welcomeCycle: 0,
};

let safetyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function clearSafetyTimer() {
  if (safetyTimer !== null) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

export const assistantUiActions = {
  startFirstMessageScatter(reducedMotion = false) {
    clearSafetyTimer();
    if (state.firstMessageSent) return;

    if (reducedMotion) {
      state = {
        ...state,
        isScattering: false,
        firstMessageSent: true,
      };
      emit();
      return;
    }

    state = {
      ...state,
      isScattering: true,
    };
    emit();

    // Safety guard so chat messages never get stuck if canvas teardown finishes early
    safetyTimer = setTimeout(() => {
      assistantUiActions.completeScatter();
    }, 1250);
  },

  completeScatter() {
    clearSafetyTimer();
    if (!state.isScattering && state.firstMessageSent) return;
    state = {
      ...state,
      isScattering: false,
      firstMessageSent: true,
    };
    emit();
  },

  markConversationActive() {
    clearSafetyTimer();
    if (state.firstMessageSent && !state.isScattering) return;
    state = {
      ...state,
      isScattering: false,
      firstMessageSent: true,
    };
    emit();
  },

  resetWelcome() {
    clearSafetyTimer();
    state = {
      firstMessageSent: false,
      isScattering: false,
      welcomeCycle: state.welcomeCycle + 1,
    };
    emit();
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AssistantUiState {
  return state;
}

const SERVER_SNAPSHOT: AssistantUiState = {
  firstMessageSent: false,
  isScattering: false,
  welcomeCycle: 0,
};

function getServerSnapshot(): AssistantUiState {
  return SERVER_SNAPSHOT;
}

export function useAssistantUi() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snapshot,
    ...assistantUiActions,
  };
}
