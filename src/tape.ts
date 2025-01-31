
import { Task, type TimedTask } from "./tasks";
import { easeInOut, type Vec2 } from "./utils";


export type Tape = {
  readonly contents: Uint8ClampedArray;
  readonly length: number;
  readonly padding: number;
  readonly is_cursor_expanded: boolean;
  readonly cursor_index: number;
  cell_size: number;
  alpha: number;
  position: Vec2;
  task: Task | null;

  render(ctx: CanvasRenderingContext2D): void;
  update(dt: number): void;
  set_value_at_cursor(value: number): void;
  get_value_at_cursor(): number;
  expand_cursor(): void;
  contract_cursor(): void;

  task_expand_cursor(): Task;
  task_expand_cursor(duration: number): Task;
  task_contract_cursor(): Task;
  task_contract_cursor(duration: number): Task;
  task_move_cursor_to(cell_idx: number): Task;
  task_move_cursor_to(cell_idx: number, seconds_per_cell: number): Task;
  task_move_cursor_by(cell_count: number): Task;
  task_move_cursor_by(cell_count: number, seconds_per_cell: number): Task;
};

function draw_tape_cell(ctx: CanvasRenderingContext2D, cell_padding: number, cell_idx: number, cell_size: number, cell_val: number): void {
  const x = (cell_size + cell_padding) * cell_idx;
  const y = 0;

  ctx.fillStyle = "#FFF";
  ctx.fillRect(x, y, cell_size, cell_size);

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#151515";
  ctx.fillText(String(cell_val), x + cell_size / 2, y + cell_size / 2);

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, cell_size, cell_size);

}

function draw_tape_cursor(ctx: CanvasRenderingContext2D, cell_size: number) {
  const padd = 8;
  const hpad = padd / 2;
  ctx.strokeStyle = "#EAA1FF";
  ctx.lineWidth = 4;
  ctx.strokeRect(-hpad, -hpad, cell_size + padd, cell_size + padd);
}

export function createTape(cfg: { x: number, y: number, cell_size: number, len?: number; padding?: number; }): Tape {
  const { x, y } = cfg;
  const baseX = cfg.x;
  const len = cfg.len ?? 10;
  const padding = cfg.padding ?? 4;
  const contents = new Uint8ClampedArray(len);

  let gen_cell_size = cfg.cell_size;
  let cur_cell_size = gen_cell_size;
  let is_cursor_exp = false;

  const tape: Tape = {
    alpha: 1,
    position: { x, y },
    contents,
    get cell_size() {
      return gen_cell_size;
    },
    set cell_size(new_size: number) {
      gen_cell_size = Math.max(new_size, 5);
      cur_cell_size = gen_cell_size;
      if (!is_cursor_exp) {
        return;
      }
      cur_cell_size += tape.padding;
    },
    padding,

    task_expand_cursor(duration: number = 0.5) {
      return Task.new_timed({
        duration,
        update(step) {
          const size = easeInOut(gen_cell_size, gen_cell_size + tape.padding, step);
          cur_cell_size = size;
          if (step >= 1) {
            is_cursor_exp = true;
          }
        },
      });
    },
    task_contract_cursor(duration: number = 0.5) {
      let start: number | null = null;
      return Task.new_timed({
        duration,
        update(step) {
          if (start == null) {
            start = cur_cell_size;
          }
          const size = easeInOut(start, gen_cell_size, step);
          cur_cell_size = size;
          if (step >= 1) {
            is_cursor_exp = false;
          }
        },
      });
    },
    expand_cursor() {
      if (is_cursor_exp) return;
      is_cursor_exp = true;
      cur_cell_size = gen_cell_size + tape.padding;
    },
    contract_cursor() {
      if (!is_cursor_exp) return;
      is_cursor_exp = false;
      cur_cell_size = gen_cell_size;
    },
    get is_cursor_expanded() {
      return is_cursor_exp;
    },

    task_move_cursor_to(cell_idx: number, seconds_per_cell: number = 0.5): Task {
      let start: number = seconds_per_cell;
      let end: number = seconds_per_cell;
      let duration: number = seconds_per_cell;
      cell_idx = Math.min(Math.max(cell_idx, 0), tape.contents.length);
      let sub_task: Task | null;

      return Task.new_sequence(
        Task.new_wait_secs(0.15),
        {
          time: -1,
          get duration() {
            return duration;
          },
          update(dt) {
            if (sub_task) {
              sub_task.update(dt);
              if (sub_task.is_done()) {
                sub_task = null;
              }
              return;
            }
            if (this.time === -1) {
              this.time = 0;
              if (!is_cursor_exp) {
                sub_task = tape.task_expand_cursor(1);
              }
              start = tape.position.x;
              end = baseX - (tape.cell_size + tape.padding) * cell_idx;
              const cell_count = Math.abs((end - start) / (tape.cell_size + tape.padding));
              duration = cell_count * seconds_per_cell;
            }
            if (sub_task) {
              sub_task.update(dt);
              if (sub_task.is_done()) {
                sub_task = null;
              }
              return;
            }
            this.time += dt;

            const step = Task.time_step(this.time, duration);
            tape.position.x = easeInOut(start, end, step);
          },
          is_done() {
            return this.time >= this.duration;
          },
        } as TimedTask,
        tape.task_contract_cursor(),
      );
    },

    task_move_cursor_by(cell_count: number, seconds_per_cell: number = 0.5): Task {
      let start: number | null = null;
      let end: number | null = null;

      return Task.new_sequence(
        Task.new_wait_secs(0.15),
        tape.task_expand_cursor(1),
        Task.new_timed({
          duration: seconds_per_cell * Math.abs(cell_count),
          update(step) {
            if (start == null) {
              start = tape.position.x;
            }
            if (end == null) {
              end = start - (tape.cell_size + tape.padding) * (cell_count);
            }
            const x = easeInOut(start, end, step);
            tape.position.x = x;
          },
        }),
        tape.task_contract_cursor(1),
      );
    },

    get cursor_index() {
      const cell_index = (baseX - tape.position.x) / (tape.cell_size + tape.padding);
      return cell_index;
    },

    get_value_at_cursor() {
      const cell_index = (baseX - tape.position.x) / (tape.cell_size + tape.padding);
      return tape.contents[cell_index];
    },
    set_value_at_cursor(value: number) {
      const cell_index = (baseX - tape.position.x) / (tape.cell_size + tape.padding);
      tape.contents[cell_index] = value;
    },

    task: null,
    update(dt) {
      if (!tape.task) return;
      tape.task.update(dt);
    },
    render(ctx) {
      const prev_alpha = ctx.globalAlpha;
      ctx.globalAlpha = tape.alpha;
      ctx.save();
      ctx.translate(tape.position.x - tape.cell_size / 2, tape.position.y - tape.cell_size / 2);
      for (let i = 0; i < tape.contents.length; ++i) {
        draw_tape_cell(ctx, tape.padding, i, gen_cell_size, tape.contents[i]);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(baseX - cur_cell_size / 2, tape.position.y - cur_cell_size / 2);
      draw_tape_cursor(ctx, cur_cell_size);
      ctx.restore();
      ctx.globalAlpha = prev_alpha;
    },
    get length() {
      return contents.length;
    },
  };

  return tape;
}




