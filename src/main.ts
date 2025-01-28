import './style.css'
import { zer } from "./zer";

const WIDTH = 800;
const HEIGHT = WIDTH / 16 * 9;

// const app = document.querySelector("#app")!;
const cnv = document.querySelector<HTMLCanvasElement>("#cnv")!;

let paused = false;
// @ts-expect-error Am adding the things bellow
const Inputs: {
  is_key_just_pressed(key: string): boolean;
  is_key_down(key: string): boolean;
  on_key_just_pressed(key: string, cb: () => any): void;
  on_key_just_pressed(key: string, cb: () => any, once: boolean): void;
  on_key_pressed(key: string, cb: () => any): void;
  on_any_key_just_pressed(cb: () => any): void;
  on_any_key_just_pressed(cb: () => any, once: boolean): void;
} = {};
{
  const keysStatus = new Map<string, { down: boolean; held: boolean; key: string; }>();
  const keyJustPressedSubscribers: Record<string, Array<{ cb: () => any; once: boolean; }>> = {};
  const keyDownSubscribers: Record<string, Array<{ cb: () => any; once: boolean; }>> = {};
  const anyKeyJustPressedSubscribers: Array<{ cb: () => any; once: boolean }> = [];
  Inputs.is_key_just_pressed = (key) => {
    const k = keysStatus.get(key);
    if (!k) return false;
    return k.down && !k.held;
  };
  Inputs.is_key_down = (key) => {
    const k = keysStatus.get(key);
    if (!k) return false;
    return k.down || k.held;
  };
  Inputs.on_key_just_pressed = (key, cb, once: boolean = false) => {
    const list = keyJustPressedSubscribers[key] ?? [];
    list.unshift({ cb, once });
    keyJustPressedSubscribers[key] = list;
  };
  Inputs.on_key_pressed = (key, cb, once: boolean = false) => {
    const list = keyDownSubscribers[key] ?? [];
    list.unshift({ cb, once });
    keyDownSubscribers[key] = list;
  };
  Inputs.on_any_key_just_pressed = (cb, once: boolean = false) => {
    anyKeyJustPressedSubscribers.unshift({ cb, once });
  };
  cnv.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key.length == 0) return;
    const k = keysStatus.get(key) ?? { down: false, held: false, key: key, };
    if (k.down == true) {
      k.held = true;
      const list = keyDownSubscribers[key];
      if (list) {
        for (let i = list.length - 1; i >= 0; --i) {
          const { cb, once } = list[i];
          cb();
          if (once) {
            list.splice(i, 1);
          }
        }
      }
    } else {
      k.down = true;
      for (let i = anyKeyJustPressedSubscribers.length - 1; i >= 0; --i) {
        const { cb, once } = anyKeyJustPressedSubscribers[i];
        cb();
        if (once) {
          anyKeyJustPressedSubscribers.splice(i, 1);
        }
      }
      const list = keyJustPressedSubscribers[key];
      if (list) {
        for (let i = list.length - 1; i >= 0; --i) {
          const { cb, once } = list[i];
          cb();
          if (once) {
            list.splice(i, 1);
          }
        }
      }
    }
    keysStatus.set(key, k);
  });

  cnv.addEventListener("keyup", (event) => {
    const k = keysStatus.get(event.key) ?? { down: false, held: false, key: event.key, };
    k.down = false;
    k.held = false;
    keysStatus.set(event.key, k);
  });

  cnv.focus();
}

Inputs.on_key_just_pressed("p", () => paused = !paused);

type Cell = {
  box: Rect;
  text: ReturnType<typeof text>
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
};

zer.run(function* main() {
  console.log("Hello, world");
  cnv.width = WIDTH;
  cnv.height = HEIGHT;

  const ctx = cnv.getContext("2d");
  if (!ctx) throw new Error(`No 2D context in ${new Date().getFullYear()}?`);
  ctx.imageSmoothingEnabled = false;
  let ctxTask: Task | null = (() => {
    const startFontSize = 200 * 0.64;
    const endFontSize = 32;
    ctx.font = `${startFontSize}px JetBrains Mono`;
    const resizeText: Task = {
      time: 0,
      duration: 2,
      update(dt: number) {
        this.time += dt;
        const timeStep = taskTimeStep(this.time, this.duration);
        const fontSize = lerp(startFontSize, endFontSize, timeStep);
        ctx.font = `${fontSize}px bold JetBrains Mono`;
      }
    };

    const waitForInpToStart = task_waitForKey();

    const moveTape: Task = {
      time: 0,
      duration: 0,
      update(dt) {
        this.time += dt;
        const MOVE_CELLS_BY = tape.length / 2;
        tape[MOVE_CELLS_BY].text.str = "1";
        const cursorResize = (cellSeq: Array<Task>, targetSize: number) => {
          const duration = 0.25;
          cellSeq.push(task_doOnce(() => {
            cursor.animation_task = Rect.taskResizeTo(cursor, {
              duration: duration,
              targetW: targetSize,
              targetH: targetSize,
            });
          }));
          cellSeq.push(task_wait(duration));
        };
        for (let cellIdx = 0; cellIdx < tape.length; ++cellIdx) {
          const cell = tape[cellIdx];
          const cellSeq: Array<Task> = [];
          for (let i = 1; i <= MOVE_CELLS_BY; ++i) {
            cursorResize(cellSeq, cellSize + 10);
            cellSeq.push(task_wait(0.25));


            const destX = cell.box.x - ((cellSize + 4) * i);
            const fromX = i === 1 ? cell.box.x : cell.box.x - ((cellSize + 4) * (i - 1));
            const move = task_moveTo(cell.box, {
              duration: 1,
              fromX, destX,
              destY: cell.box.y,
              interpolation: "ease-in-out",
            });
            cellSeq.push(move);

            cursorResize(cellSeq, cellSize + 6);

            cellSeq.push(task_wait(0.5));

            if (destX === WIDTH / 2) {
              cellSeq.push({
                time: 0,
                duration: 1,
                update() {
                  this.time += this.duration;
                  if (cell.text.str === "1") {
                    cell.text.str = "0";
                    return;
                  }
                  cell.text.str = "1";
                },
              });
            } else {
              cellSeq.push(task_wait(0));
            }
            cellSeq.push(task_wait(1));

            cursorResize(cellSeq, cellSize + 10);

            cellSeq.push(task_moveTo(cell.box, {
              duration: 0.5 * i,
              fromX: destX,
              destX: WIDTH / 2 + ((cellSize + 4) * cellIdx),
              destY: cell.box.y,
              interpolation: "ease-in-out",
            }));

            cursorResize(cellSeq, cellSize + 6);
            cellSeq.push(task_wait(0.5));
            if (cellIdx === 0) {
              cellSeq.push({
                time: 0,
                duration: 1,
                update() {
                  this.time += this.duration;
                  const x = +cell.text.str;
                  cell.text.str = String(x + 1);
                },
              });
            } else {
              cellSeq.push(task_wait(0));
            }
            cellSeq.push(task_wait(0.5));

            cursorResize(cellSeq, cellSize + 10);
            cellSeq.push(task_moveTo(cell.box, {
              duration: 0.5 * i,
              fromX: WIDTH / 2 + ((cellSize + 4) * cellIdx),
              destX,
              destY: cell.box.y,
              interpolation: "ease-in-out",
            }));

            cursorResize(cellSeq, cellSize + 6);
          }

          if (cell.box.animation_task) {
            cell.box.animation_task = task_sequence(cell.box.animation_task, ...cellSeq);
            continue;
          }

          cell.box.animation_task = task_sequence(...cellSeq);
        }

        tape[MOVE_CELLS_BY].box.animation_task = task_sequence(
          tape[MOVE_CELLS_BY].box.animation_task!,
          {
            time: 0,
            duration: 1,
            update() {
              this.time += this.duration;
              tape[MOVE_CELLS_BY].text.str = "0";
            },
          }
        );
      },
    };

    const clear: Task = {
      time: 0,
      duration: 0,
      update() {
        ctxTask = null;
      },
    };

    return task_sequence(resizeText, waitForInpToStart, moveTape, clear);
  })();

  const tape: Array<Cell> = [];
  const startSize = 200;
  const cellSize = 50;
  const cursor = rect({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    w: startSize + 20,
    borderWidth: 4,
    borderColor: rgb(255, 0, 200),
    fillColor: null,
  });
  cursor.animation_task = Rect.taskResizeTo(cursor, {
    duration: 2,
    targetW: cellSize + 6,
    targetH: cellSize + 6,
  });
  for (let i = 0; i < 20; ++i) {
    const startOffset = (startSize + 4) * i;
    const endOffset = (cellSize + 4) * i;
    tape.push({
      box: rect({
        x: WIDTH / 2 + startOffset,
        y: HEIGHT / 2,
        w: startSize,
        borderColor: ColorRGBA.BLACK,
        borderWidth: 2,
      }),
      text: text("0", startSize / 2, startSize / 2),
      update(dt) {
        this.box.update(dt);
      },
      render(ctx) {
        this.box.render(ctx);
      },
    });
    const cell = tape[tape.length - 1];
    cell.box.children.push(cell.text);
    cell.text.task = task_moveTo(cell.text, { duration: 2, destX: cellSize / 2, destY: cellSize / 2, interpolation: "linear", });
    const resizeTask = Rect.taskResizeTo(cell.box, {
      duration: 2,
      targetW: cellSize,
      targetH: cellSize,
    });
    if (i === 0) {
      cell.box.animation_task = resizeTask;
      continue;
    }
    const moveTask = Rect.taskMoveTo(cell.box, {
      duration: 2,
      destX: WIDTH / 2 + endOffset,
      destY: HEIGHT / 2,
    });
    cell.box.animation_task = task_parallel(resizeTask, moveTask);
  }

  const render = (dt: number) => {
    if (paused) return;
    ctx.fillStyle = "#515151";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 4;
    for (const rt of tape) {
      rt.render(ctx);
      rt.update(dt);
    }

    cursor.render(ctx);
    cursor.update(dt);

    if (ctxTask) ctxTask.update(dt);
  };

  yield animate(render);
});

function* animate(fn: (deltaTime: number) => any) {
  let before = yield* zer.nextAnimationFrame();
  while (true) {
    const now = yield* zer.nextAnimationFrame();
    const dt = now - before;
    fn(dt);
    before = now;
  }
}

class ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
  constructor(r: number, g: number, b: number, a: number) {
    this.set = this.set.bind(this);
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  set(this: ColorRGBA, r: number, g: number, b: number, a: number = this.a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;

    return this;
  }

  toString() {
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
  }

  static get WHITE() {
    return new ColorRGBA(255, 255, 255, 1);
  }

  static get BLACK() {
    return new ColorRGBA(0, 0, 0, 1);
  }
}
function rgb(r: number, g: number, b: number, a: number = 1) {
  return new ColorRGBA(r, g, b, a);
}

class Rect {

  borderColor?: ColorRGBA | null;
  borderWidth: number;
  fillColor?: ColorRGBA | null;
  animation_task: Task | null;
  children: Array<{ render: (ctx: CanvasRenderingContext2D) => void; update?: (dt: number) => void; }>;

  constructor(public x: number, public y: number, public w: number, public h: number) {
    this.render = this.render.bind(this);
    this.update = this.update.bind(this);
    this.borderWidth = 4;
    this.borderColor = null;
    this.fillColor = rgb(255, 255, 255);
    this.animation_task = null;
    this.children = [];
  }

  update(dt: number) {
    if (this.animation_task == null) {
      for (const child of this.children) {
        child.update?.(dt);
      }
      return;
    }
    this.animation_task.update(dt);
    for (const child of this.children) {
      child.update?.(dt);
    }
    if (!taskDone(this.animation_task)) {
      return;
    }
    this.animation_task = null;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    ctx.translate(Math.floor(this.x - this.w / 2), Math.floor(this.y - this.h / 2));
    if (this.fillColor != null) {
      ctx.fillStyle = this.fillColor.toString();
      ctx.fillRect(0, 0, this.w, this.h);
    }

    for (const child of this.children) {
      child.render(ctx);
    }

    if (this.borderColor != null) {
      ctx.lineWidth = this.borderWidth;
      ctx.strokeStyle = this.borderColor.toString();
      ctx.strokeRect(0, 0, this.w, this.h);
    }

    ctx.restore();
  }

  static taskResizeTo(rect: Rect, cfg: { targetW: number; targetH: number; duration: number }): Task {
    const startW = rect.w;
    const startH = rect.h;
    const { duration, targetW, targetH } = cfg;
    const task: Task = {
      time: 0,
      duration,
      update(dt: number) {
        task.time += dt;
        const time = taskTimeStep(task.time, task.duration);
        const w = lerp(startW, targetW, time);
        const h = lerp(startH, targetH, time);
        rect.w = w;
        rect.h = h;
      },
    };

    return task;
  }

  static taskMoveTo(rect: Rect, config: { duration: number; destX: number; destY: number }): Task {
    const duration = config.duration;

    const startX = rect.x;
    const startY = rect.y;
    const endX = config.destX;
    const endY = config.destY;

    const task: Task = {
      time: 0,
      duration,
      update(dt: number) {
        task.time += dt;
        const time = taskTimeStep(task.time, task.duration);
        const posX = lerp(startX, endX, time);
        const posY = lerp(startY, endY, time);
        rect.x = posX;
        rect.y = posY;
      },
    };

    return task;
  }
}


type RectCreateConfig = {
  x: number; y?: number;
  w: number; h?: number;
  borderColor?: ColorRGBA | null;
  borderWidth?: number;
  fillColor?: ColorRGBA | null;
};
function rect(cfg: RectCreateConfig) {
  const x = cfg.x;
  const y = cfg.y ?? cfg.x;
  const w = cfg.w;
  const h = cfg.h ?? cfg.w;

  const rt = new Rect(x, y, w, h);

  if ("borderColor" in cfg) {
    const bc = cfg.borderColor;
    rt.borderColor = bc;
  }

  const bw = cfg.borderWidth ?? 2;
  rt.borderWidth = bw;

  if ("fillColor" in cfg) {
    const fc = cfg.fillColor;
    rt.fillColor = fc;
  }

  return rt;
}

function text(str: string, x: number, y: number) {
  return {
    x, y,
    str,
    task: null as Task | null,
    render(ctx: CanvasRenderingContext2D) {
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(this.str, this.x, this.y);
    },
    update(dt: number) {
      const task = this.task;
      if (task == null) return;
      task.update(dt);
    },
  };
}


type Task = {
  readonly update: (dt: number) => void;
  readonly duration: number;
  time: number;
}

function expDecay(fromA: number, toB: number, dt: number, decay: number = 6) {
  return toB + (fromA - toB) * Math.exp(-decay * dt);
}


function lerp(a: number, b: number, step: number): number {
  return a + (b - a) * step;
}

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function easeInOut(a: number, b: number, step: number): number {
  return a + (b - a) * easeInOutSine(step);
}

function taskTimeStep(taskTime: number, taskDuration: number): number {
  if (taskTime >= taskDuration) {
    return 1;
  }
  if (taskTime <= 0) {
    return 0;
  }
  return taskTime / taskDuration;
}

function getInterpolationFn(name: "linear" | "exp-decay" | "ease-in-out") {
  switch (name) {
    case "linear":
      return lerp;
    case "exp-decay":
      return expDecay;
    case "ease-in-out":
      return easeInOut;
    default:
      throw new Error("Unknown interpolation function name: " + name);
  }
}

function task_moveTo(obj: { x: number; y: number; }, cfg: { duration: number; fromX?: number; fromY?: number; destX: number; destY: number; interpolation?: "linear" | "exp-decay" | "ease-in-out"; }): Task {
  const duration = cfg.duration;
  const startX = cfg.fromX ?? obj.x;
  const startY = cfg.fromY ?? obj.y;
  const endX = cfg.destX;
  const endY = cfg.destY;
  const useInterpolation = getInterpolationFn(cfg.interpolation ?? "exp-decay");

  const task: Task = {
    time: 0,
    duration,
    update(dt: number) {
      task.time += dt;
      const time = taskTimeStep(task.time, task.duration);
      const posX = useInterpolation(startX, endX, time);
      const posY = useInterpolation(startY, endY, time);
      obj.x = posX;
      obj.y = posY;
    },
  };

  return task;
}

function task_wait(seconds: number): Task {
  const task: Task = {
    time: 0,
    duration: seconds,
    update(dt) {
      task.time += dt;
    },
  };

  return task;
}
function task_doOnce(action: (dt: number) => any): Task {
  const task: Task = {
    time: 0,
    duration: 1,
    update(dt) {
      task.time += task.duration;
      action(dt);
    },
  };

  return task;
}

function task_waitForKey(key?: string): Task {
  let pressed = false;
  if (key) {
    Inputs.on_key_just_pressed(key, () => pressed = true, true);
  } else {
    Inputs.on_any_key_just_pressed(() => pressed = true, true);
  }
  const task: Task = {
    time: 0,
    duration: 1,
    update() {
      if (!pressed) return;
      task.time = task.duration;
    },
  };

  return task;
}

function task_parallel(...tasks: Task[]): Task {
  // Reserve space
  let newTasks = new Array(tasks.length);
  const task: Task = {
    time: 0,
    duration: 1,
    update(dt) {
      if (tasks.length === 0) return;

      newTasks.length = 0;
      for (const t of tasks) {
        t.update(dt);
        if (taskDone(t)) continue;
        newTasks.push(t);
      }

      // Simple swap to evade making a bunch of new arrays
      let tmp = tasks;
      tasks = newTasks;
      newTasks = tmp;
      if (tasks.length == 0) {
        task.time = task.duration;
      }
    },
  };

  return task;
}

function task_sequence(...tasks: Task[]): Task {
  tasks.reverse();

  const sequence: Task = {
    time: 0,
    duration: tasks.reduce((acc, cur) => acc + cur.duration, 0),
    update(dt) {
      if (tasks.length === 0) {
        return;
      }
      const curTask = tasks[tasks.length - 1];
      curTask.update(dt);
      if (!taskDone(curTask)) {
        return;
      }
      tasks.pop();
      sequence.time += curTask.duration;
    }
  };

  return sequence;
}

function taskDone(task: Task): boolean {
  return task.time >= task.duration;
}



