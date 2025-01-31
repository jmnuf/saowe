import './style.css'
import { zer } from "./zer";
import { createInputManager } from "./inputs";
import { createTape } from "./tape";
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
// Make the canvas focusable
cnv.setAttribute("tabindex", "0");
cnv.width = WIDTH;
cnv.height = HEIGHT;

let paused = false;

const Inputs = createInputManager(cnv);
cnv.focus();

Inputs.on_key_just_pressed("p", () => paused = !paused);

let _tapes: any = {};
zer.run(function* main() {
  const ctx = cnv.getContext("2d");
  if (!ctx) throw new Error(`No 2D context in ${new Date().getFullYear()}?`);
  ctx.imageSmoothingEnabled = false;
  // ctx.font = `32px JetBrains Mono`;
  // ctx.font = `32px Courier New`;

  const tape = createTape({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    cell_size: 200,
    len: 25,
  });
  const memory_tape = createTape({
    x: WIDTH / 2,
    y: HEIGHT / 4 * 3,
    cell_size: 50,
    len: 255,
  });
  memory_tape.alpha = 0;
  for (let i = 0; i < memory_tape.length; ++i) {
    memory_tape.contents[i] = Math.floor(Math.random() * 256);
  }
  _tapes.main = tape;
  _tapes.mem = memory_tape;

  const render = (dt: number) => {
    if (paused) return;
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#515151";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";


    tape.render(ctx);
    tape.update(dt);
    memory_tape.render(ctx);
    memory_tape.update(dt);
  };
  // Start the rendering on a separate promise
  zer.run(() => zer.animate(render)).catch(console.error);


  {
    const startSize = tape.cell_size;
    const endSize = 50;
    const startFontSize = 200 * 0.64;
    const endFontSize = 32;
    tape.contents[10] = 1;
    const memory = {
      used: [] as Array<number>,
      request(): number {
        let mem_idx = Math.floor(Math.random() * memory_tape.length);
        while (this.used.includes(mem_idx)) {
          mem_idx = Math.floor(Math.random() * memory_tape.length);
        }
        memory.used.push(mem_idx);
        return mem_idx;
      },
    }
    ctx.font = `${startFontSize}px JetBrains Mono`;
    type MachineState = "moving" | "idle" | "checking" | "storing";
    tape.task = Task.new_sequence(
      Task.new_timed({
        duration: 2,
        update(step) {
          const cellSize = lerp(startSize, endSize, step);
          tape.cell_size = cellSize;
          const fontSize = lerp(startFontSize, endFontSize, step);
          ctx.font = `${fontSize}px JetBrains Mono`;
        },
      }),
      Task.new_concurrent(
        memory_tape.task_expand_cursor(),
        Task.new_interpolate_key({
          duration: 2,
          obj: memory_tape,
          key: "alpha",
          target: 1,
        }),
      ),
      Task.new_wait_secs(2),
      Task.copy({
        save_stack: [] as Array<number>,
        completed: false,
        prv_state: "idle" as MachineState,
        cur_state: "idle" as MachineState,
        action: null as Task | null,
        first_frame: true,

        set_state(state: MachineState) {
          this.prv_state = this.cur_state;
          this.cur_state = state;
        },
        update(dt: number) {
          if (this.completed) return;

          if (this.first_frame) {
            this.first_frame = false;
            const mem_idx = memory.request();
            this.action = Task.new_sequence(
              memory_tape.task_move_cursor_to(mem_idx, 0.01),
              Task.new_do_once(() => tape.set_value_at_cursor(mem_idx)),
              Task.new_do_once(() => memory_tape.set_value_at_cursor(0)),
              memory_tape.task_expand_cursor(),
              Task.new_wait_secs(0.5),
              tape.task_move_cursor_by(1),
              Task.new_do_once(() => {
                this.prv_state = "moving";
                this.cur_state = "checking";
              }),
            );
          }

          if (this.action == null) {
            switch (this.cur_state) {
              case "moving":
                this.action = tape.task_move_cursor_by(1);
                this.set_state("checking");
                return

              case "storing":
                const mem_idx = tape.get_value_at_cursor();
                let x = 0;
                this.action = Task.new_sequence(
                  memory_tape.task_move_cursor_to(mem_idx, 0.05),
                  Task.new_do_once(() => x = memory_tape.get_value_at_cursor()),
                  memory_tape.task_expand_cursor(),
                  memory_tape.task_contract_cursor(),
                  Task.new_do_once(() => memory_tape.set_value_at_cursor(x + 1)),
                  Task.new_concurrent(
                    tape.task_move_cursor_to(this.save_stack.pop()!),
                    memory_tape.task_expand_cursor(),
                  ),
                );
                this.set_state("moving");
                return;

              case "checking":
                if (tape.get_value_at_cursor() !== 0) {
                  this.set_state("idle");
                  return;
                }
                this.save_stack.push(tape.cursor_index);
                this.action = tape.task_move_cursor_to(0);
                this.set_state("storing");
                return;

              default:
                this.completed = true;
                return;
            }
          }
          const action = this.action!;
          action.update(dt);
          if (action.is_done()) {
            this.action = null;
          }
        },
        is_done() {
          return (this as any).completed;
        },
      }),
    );
  }
});


// @ts-ignore Just adding these for extra debugging while tasks are running 
window.__SAOWE = {
  get width() {
    return WIDTH;
  },
  get height() {
    return HEIGHT;
  },
  get paused() {
    return paused;
  },
  get tapes() {
    return _tapes;
  },
};
