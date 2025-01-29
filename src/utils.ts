export function expDecay(fromA: number, toB: number, dt: number, decay: number = 6) {
  return toB + (fromA - toB) * Math.exp(-decay * dt);
}


export function lerp(a: number, b: number, step: number): number {
  return a + (b - a) * step;
}

export function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function easeInOut(a: number, b: number, step: number): number {
  return a + (b - a) * easeInOutSine(step);
}

export type Interpolators = "linear" | "exp-decay" | "ease-in-out";
export function getInterpolationFn(name: Interpolators) {
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
