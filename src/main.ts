import './style.css'
import { zer } from "./zer";

const WIDTH = 800;
const HEIGHT = WIDTH / 16 * 9;

// const app = document.querySelector("#app")!;
const cnv = document.querySelector<HTMLCanvasElement>("#cnv")!;

zer.run(function* main() {
  console.log("Hello, world");
  cnv.width = WIDTH;
  cnv.height = HEIGHT;

  const ctx = cnv.getContext("2d");
  if (!ctx) throw new Error(`No 2D context in ${new Date().getFullYear()}?`);
  ctx.imageSmoothingEnabled = false;
  ctx.font = "48px Times New Roman";
  let ctxTask: Task | null = {
    time: 0,
    duration: 2,
    update(dt: number) {
      this.time += dt;
      const timeStep = taskTimeStep(this.time, this.duration);
      const fontSize = lerp(64, 32, timeStep);
      ctx.font = `${fontSize}px Times New Roman`;
      if (taskDone(this)) {
        ctxTask = null;
      }
    }
  };

  const tape: Array<Rect> = [];
  const startSize = 200;
  const endSize = 50;
  const cursor = rect({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    w: startSize + 20,
    borderWidth: 4,
    borderColor: rgb(255, 0, 200),
    fillColor: null,
  });
  cursor.animation_task = Rect.taskReziseTo(cursor, {
    duration: 2,
    targetW: endSize + 6,
    targetH: endSize + 6,
  });
  const HALF_TAPE_SIZE = 10;
  for (let i = -HALF_TAPE_SIZE + 1; i <= HALF_TAPE_SIZE; ++i) {
    const startOffset = (startSize + 4) * i;
    const endOffset = (endSize + 4) * i;
    const box = rect({
      x: WIDTH / 2 + startOffset,
      y: HEIGHT / 2,
      w: startSize,
      borderColor: ColorRGBA.BLACK,
      borderWidth: 2,
    });
    const boxText = text("0", box.w / 2, box.w / 2);
    box.children.push(boxText);
    boxText.task = task_moveTo(boxText, { duration: 2, destX: endSize / 2, destY: endSize / 2, });
    const resizeTask = Rect.taskReziseTo(box, {
      duration: 2,
      targetW: endSize,
      targetH: endSize,
    });
    if (i === 0) {
      box.animation_task = resizeTask;
    } else {
      const moveTask = Rect.taskMoveTo(box, {
        duration: 2,
        destX: WIDTH / 2 + endOffset,
        destY: HEIGHT / 2,
      });
      box.animation_task = task_seq(resizeTask, moveTask);
    }
    tape.push(box);
  }

  const render = (dt: number) => {
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

// function expDecay(fromA: number, toB: number, dt: number, decay: number = 6) {
//   return toB + (fromA - toB) * Math.exp(-decay * dt);
// }

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

    ctx.translate(this.x - this.w / 2, this.y - this.h / 2);
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

  static taskReziseTo(rect: Rect, cfg: { targetW: number; targetH: number; duration: number }): Task {
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

function lerp(a: number, b: number, step: number): number {
  return a + (b - a) * step;
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

function task_moveTo(obj: { x: number; y: number; }, cfg: { duration: number; destX: number; destY: number; }): Task {
  const duration = cfg.duration;
  const startX = obj.x;
  const startY = obj.y;
  const endX = cfg.destX;
  const endY = cfg.destY;

  const task: Task = {
    time: 0,
    duration,
    update(dt: number) {
      task.time += dt;
      const time = taskTimeStep(task.time, task.duration);
      const posX = lerp(startX, endX, time);
      const posY = lerp(startY, endY, time);
      obj.x = posX;
      obj.y = posY;
    },
  };

  return task;
}

function task_seq(...tasks: Task[]): Task {
  // Reserve space
  let newTasks = new Array(tasks.length);
  return {
    time: 0,
    duration: Infinity,
    update(dt) {
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
    },
  };
}

function taskDone(task: Task): boolean {
  return task.time >= task.duration;
}



