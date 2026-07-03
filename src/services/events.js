const listeners = {};

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
  return () => off(event, cb);
}

export function off(event, cb) {
  if (!listeners[event]) return;
  const idx = listeners[event].indexOf(cb);
  if (idx !== -1) listeners[event].splice(idx, 1);
}

export function emit(event, payload) {
  if (!listeners[event]) return;
  // shallow copy to avoid mutation during iteration
  const copy = listeners[event].slice();
  for (const cb of copy) {
    try { cb(payload); } catch (e) { /* ignore listener errors */ }
  }
}

export default { on, off, emit };
