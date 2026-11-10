// Idle detection for the home page warning, kept free of DOM access so it can be unit tested.

export const IDLE_WARNING_MS = 67 * 1000;
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'];

// Calls onIdle once after `timeout` ms without activity(). Further activity starts a
// new countdown, so the warning can appear again after the person comes back and idles.
export function createIdleWatcher({ onIdle, timeout = IDLE_WARNING_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let handle = null;
  let running = false;

  function arm() {
    clearTimer(handle);
    handle = setTimer(() => {
      handle = null;
      onIdle();
    }, timeout);
  }

  return {
    start() {
      running = true;
      arm();
    },
    activity() {
      if (running) arm();
    },
    stop() {
      running = false;
      clearTimer(handle);
      handle = null;
    },
  };
}
