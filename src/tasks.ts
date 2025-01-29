import type { InputManager } from "./inputs";
import { getInterpolationFn, type Interpolators } from "./utils";

function taskTimeStep(taskTime: number, taskDuration: number): number {
  if (taskTime >= taskDuration) {
    return 1;
  }
  if (taskTime <= 0) {
    return 0;
  }
  return taskTime / taskDuration;
}


export type Task = {
  readonly update: (dt: number) => void;
  readonly is_done: () => boolean;
  readonly duration?: number;
  time?: number;
}
export type TimedTask = Task & {
  readonly duration: number;
  time: number;
}

function new_task_moveTo(obj: { x: number; y: number; }, cfg: { duration: number; fromX?: number; fromY?: number; destX: number; destY: number; interpolation?: Interpolators; }): Task {
  const duration = cfg.duration;
  const startX = cfg.fromX ?? obj.x;
  const startY = cfg.fromY ?? obj.y;
  const endX = cfg.destX;
  const endY = cfg.destY;
  const useInterpolation = getInterpolationFn(cfg.interpolation ?? "exp-decay");

  const task: TimedTask = {
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
    is_done() {
      return task.time >= task.duration && obj.x === endX && obj.y === endY;
    },
  };

  return task;
}

function new_task_wait(seconds: number): Task {
  const task: TimedTask = {
    time: 0,
    duration: seconds,
    update(dt) {
      task.time += dt;
    },
    is_done() {
      return task.time >= task.duration;
    },
  };

  return task;
}

function new_task_doOnce(action: (dt: number) => any): Task {
  let done = false;
  const task: Task = {
    update(dt) {
      action(dt);
      done = true;
    },
    is_done() {
      return done;
    },
  };

  return task;
}

function new_task_waitForKey(Inputs: InputManager, key?: string): Task {
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
    is_done() {
      return pressed;
    }
  };

  return task;
}

function new_task_parallel(...tasks: Task[]): Task {
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
        if (t.is_done()) continue;
        newTasks.push(t);
      }

      // Simple swap to evade making a bunch of new arrays
      let tmp = tasks;
      tasks = newTasks;
      newTasks = tmp;
      newTasks.length = 0;
      if (tasks.length == 0) {
        task.time = task.duration;
      }
    },
    is_done() {
      return newTasks.length === 0 && tasks.length === 0;
    },
  };

  return task;
}

function new_task_sequence(...tasks: Task[]): Task {
  tasks.reverse();

  const sequence: Task = {
    update(dt) {
      if (tasks.length === 0) {
        return;
      }
      const curTask = tasks[tasks.length - 1];
      curTask.update(dt);
      if (!curTask.is_done()) {
        return;
      }
      tasks.pop();
    },
    is_done() {
      return tasks.length === 0;
    },
  };

  return sequence;
}

function new_task_timed(cfg: { duration: number; update: (step: number, dt: number) => any; }): TimedTask {
  const { duration, update } = cfg;
  const task: TimedTask = {
    time: 0,
    duration,
    update(dt) {
      task.time += dt;
      const step = taskTimeStep(task.time, task.duration);
      update(step, dt);
    },
    is_done() {
      return task.time >= task.duration;
    },
  };

  return task;
}

export const Task = {
  time_step: taskTimeStep,

  new_no_op: new_task_wait.bind(null, 0),
  new_timed: new_task_timed,
  new_move_to: new_task_moveTo,
  new_wait_secs: new_task_wait,
  new_do_once: new_task_doOnce,
  new_wait_key: new_task_waitForKey,
  new_seq: new_task_sequence,
  new_parallel: new_task_parallel,
};

