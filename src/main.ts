import './style.css'
import { zer } from "./zer";
import { createInputManager } from "./inputs";
import { Task } from "./tasks";
import { lerp } from "./utils";

const WIDTH = 800;
const HEIGHT = WIDTH / 16 * 9;

const app = document.querySelector("#app")!;
app.innerHTML = "";
// const cnv = document.querySelector<HTMLCanvasElement>("#cnv")!;
// <canvas tabindex="0" id="cnv"></canvas>
const cnv = app.appendChild(document.createElement("canvas"));
cnv.id = "cnv";
cnv.setAttribute("tabindex", "0");

let paused = false;
const Inputs = createInputManager(cnv);
cnv.focus();

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
    const resizeText = Task.new_timed({
      duration: 2,
      update(timeStep: number, _dt: number) {
        const fontSize = lerp(startFontSize, endFontSize, timeStep);
        ctx.font = `${fontSize}px bold JetBrains Mono`;
      },
    });

    const waitForInpToStart = Task.new_wait_key(Inputs);

    const moveTape = Task.new_do_once(() => {
      const MOVE_CELLS_BY = tape.length / 2;
      tape[MOVE_CELLS_BY].text.str = "1";
      const cursorResize = (cellSeq: Array<Task>, targetSize: number) => {
        const duration = 0.25;
        cellSeq.push(Task.new_do_once(() => {
          cursor.animation_task = Rect.taskResizeTo(cursor, {
            duration: duration,
            targetW: targetSize,
            targetH: targetSize,
          });
        }));
        cellSeq.push(Task.new_wait_secs(duration));
      };
      for (let cellIdx = 0; cellIdx < tape.length; ++cellIdx) {
        const cell = tape[cellIdx];
        const cellSeq: Array<Task> = [];
        for (let i = 1; i <= MOVE_CELLS_BY; ++i) {
          cursorResize(cellSeq, cellSize + 10);
          cellSeq.push(Task.new_wait_secs(0.25));


          const destX = cell.box.x - ((cellSize + 4) * i);
          const fromX = i === 1 ? cell.box.x : cell.box.x - ((cellSize + 4) * (i - 1));
          const move = Task.new_move_to(cell.box, {
            duration: 1,
            fromX, destX,
            destY: cell.box.y,
            interpolation: "ease-in-out",
          });
          cellSeq.push(move);

          cursorResize(cellSeq, cellSize + 6);

          cellSeq.push(Task.new_wait_secs(0.5));

          if (destX === WIDTH / 2) {
            cellSeq.push(Task.new_do_once(() => {
              if (cell.text.str === "1") {
                cell.text.str = "0";
                return;
              }
              cell.text.str = "1";
            }));
          } else {
            cellSeq.push(Task.new_no_op());
          }
          cellSeq.push(Task.new_wait_secs(1));

          cursorResize(cellSeq, cellSize + 10);

          cellSeq.push(Task.new_move_to(cell.box, {
            duration: 0.5 * i,
            fromX: destX,
            destX: WIDTH / 2 + ((cellSize + 4) * cellIdx),
            destY: cell.box.y,
            interpolation: "ease-in-out",
          }));

          cursorResize(cellSeq, cellSize + 6);
          cellSeq.push(Task.new_wait_secs(0.5));
          if (cellIdx === 0) {
            cellSeq.push(
              Task.new_do_once(() => {
                const x = +cell.text.str;
                cell.text.str = String(x + 1);
              })
            );
          } else {
            cellSeq.push(Task.new_no_op());
          }
          cellSeq.push(Task.new_wait_secs(0.5));

          cursorResize(cellSeq, cellSize + 10);
          cellSeq.push(Task.new_move_to(cell.box, {
            duration: 0.5 * i,
            fromX: WIDTH / 2 + ((cellSize + 4) * cellIdx),
            destX,
            destY: cell.box.y,
            interpolation: "ease-in-out",
          }));

          cursorResize(cellSeq, cellSize + 6);
        }

        if (cell.box.animation_task) {
          cell.box.animation_task = Task.new_seq(cell.box.animation_task, ...cellSeq);
          continue;
        }

        cell.box.animation_task = Task.new_seq(...cellSeq);
      }

      tape[MOVE_CELLS_BY].box.animation_task = Task.new_seq(
        tape[MOVE_CELLS_BY].box.animation_task!,
        Task.new_do_once(() => tape[MOVE_CELLS_BY].text.str = "0")
      );
    });

    const clear = Task.new_do_once(() => ctxTask = null);

    return Task.new_seq(resizeText, waitForInpToStart, moveTape, clear);
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
    cell.text.task = Task.new_move_to(cell.text, { duration: 2, destX: cellSize / 2, destY: cellSize / 2, interpolation: "linear", });
    const resizeTask = Rect.taskResizeTo(cell.box, {
      duration: 2,
      targetW: cellSize,
      targetH: cellSize,
    });
    if (i === 0) {
      cell.box.animation_task = resizeTask;
      continue;
    }
    const moveTask = Task.new_move_to(cell.box, {
      duration: 2,
      destX: WIDTH / 2 + endOffset,
      destY: HEIGHT / 2,
      interpolation: "linear",
    });
    cell.box.animation_task = Task.new_parallel(resizeTask, moveTask);
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
    if (!this.animation_task.is_done()) {
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

    const task = Task.new_move_to(
      {
        get x() { return rect.w; },
        set x(v) { rect.w = v; },
        get y() { return rect.h; },
        set y(v) { rect.h = v; },
      },
      {
        duration,
        fromX: startW,
        fromY: startH,
        destX: targetW,
        destY: targetH,
        interpolation: "linear",
      }
    );

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



