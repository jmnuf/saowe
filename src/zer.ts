
function* yieldP<T>(promise: Promise<T>): Generator<T, T> {
  return yield promise as any;
}

async function run<TGen extends Generator<any, TRet>, TRet>(fn: () => TGen, initVal?: any): Promise<TRet> {
  let g = fn();
  let step;
  let prevVal = initVal;
  while (true) {
    // Wait for the next event loop iteration
    await new Promise(res => setTimeout(res, 0));
    step = g.next(prevVal);
    if (step instanceof Promise) {
      step = await step;
    }
    prevVal = step.value;
    if (prevVal && prevVal instanceof Promise) {
      prevVal = await prevVal;
    }

    if (typeof prevVal === "object" && prevVal != null) {
      if ("next" in prevVal && typeof prevVal.next === "function") {
        const result = await run(() => prevVal);
        prevVal = result;
      }
    }
    if (step.done) {
      break;
    }
  }
  return step.value;
}

const nextAnimationFrame = () => zer.yieldP(new Promise<number>(res => requestAnimationFrame((time) => res(time / 1000))));

function* animate(fn: (deltaTime: number) => any) {
  let before = yield* zer.nextAnimationFrame();
  while (true) {
    const now = yield* zer.nextAnimationFrame();
    const dt = now - before;
    const val = yield fn(dt);
    before = now;
    if (val === false) {
      break;
    }
  }
}


export const zer = Object.freeze({
  yieldP,
  run,
  nextAnimationFrame,
  animate,
});

