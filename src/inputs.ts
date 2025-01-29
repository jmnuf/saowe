
export type KeyInputCallback = (event: KeyboardEvent) => any;
export type InputManager = ReturnType<typeof createInputManager>;

export function createInputManager(elem: HTMLElement) {
  const keysStatus: Record<string, { down: boolean; held: boolean; key: string; }> = {};
  const keyJustPressedSubscribers: Record<string, Array<{ cb: KeyInputCallback; once: boolean; }>> = {};
  const keyDownSubscribers: Record<string, Array<{ cb: KeyInputCallback; once: boolean; }>> = {};
  const anyKeyJustPressedSubscribers: Array<{ cb: KeyInputCallback; once: boolean }> = [];

  const is_key_just_pressed = (key: string): boolean => {
    const k = keysStatus[key];
    if (!k) return false;
    return k.down && !k.held;
  };
  const is_key_pressed = (key: string): boolean => {
    const k = keysStatus[key];
    if (!k) return false;
    return k.down || k.held;
  };
  const on_key_just_pressed = (key: string, cb: KeyInputCallback, once: boolean = false) => {
    const list = keyJustPressedSubscribers[key] ?? [];
    list.unshift({ cb, once });
    keyJustPressedSubscribers[key] = list;
  };
  const on_key_pressed = (key: string, cb: KeyInputCallback, once: boolean = false) => {
    const list = keyDownSubscribers[key] ?? [];
    list.unshift({ cb, once });
    keyDownSubscribers[key] = list;
  };
  const on_any_key_just_pressed = (cb: KeyInputCallback, once: boolean = false) => {
    anyKeyJustPressedSubscribers.unshift({ cb, once });
  };
  elem.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key.length == 0) return;
    const k = keysStatus[key] ?? { down: false, held: false, key: key, };
    if (k.down == true) {
      k.held = true;
      const list = keyDownSubscribers[key];
      if (list) {
        for (let i = list.length - 1; i >= 0; --i) {
          const { cb, once } = list[i];
          cb(event);
          if (once) {
            list.splice(i, 1);
          }
        }
      }
    } else {
      k.down = true;
      for (let i = anyKeyJustPressedSubscribers.length - 1; i >= 0; --i) {
        const { cb, once } = anyKeyJustPressedSubscribers[i];
        cb(event);
        if (once) {
          anyKeyJustPressedSubscribers.splice(i, 1);
        }
      }
      const list = keyJustPressedSubscribers[key];
      if (list) {
        for (let i = list.length - 1; i >= 0; --i) {
          const { cb, once } = list[i];
          cb(event);
          if (once) {
            list.splice(i, 1);
          }
        }
      }
    }
    keysStatus[key] = k;
  });

  elem.addEventListener("keyup", (event) => {
    const k = keysStatus[event.key] ?? { down: false, held: false, key: event.key, };
    k.down = false;
    k.held = false;
    keysStatus[event.key] = k;
  });

  return {
    is_key_just_pressed,
    is_key_pressed,
    on_key_just_pressed,
    on_key_pressed,
    on_any_key_just_pressed,
  };
}
