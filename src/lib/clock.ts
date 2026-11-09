// Injectable source of the current time so time-based rules can be tested with a controllable clock.

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
