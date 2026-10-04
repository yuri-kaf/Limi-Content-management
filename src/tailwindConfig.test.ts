// @ts-expect-error -- tailwind.config.js is plain JS with no type declarations
import twConfig from '../tailwind.config.js';
import { enter } from './motion';

// Each assertion here guards a mistake that compiles without a warning and shows
// up only as a card that looks slightly wrong or an animation that never plays.
const extend = (twConfig as any).theme.extend;
const animations: Record<string, string> = extend.animation;
const keyframes: Record<string, unknown> = extend.keyframes;

describe('tailwind.config.js', () => {
  it('names no shadow after a colour', () => {
    // `shadow-<name>` is both the box-shadow utility and the shadow-colour one,
    // so a name in both sets emits both rules and the colour wins. That is how
    // a shadow called `hover` once drew a card's hover shadow in the pale grey
    // of the `hover` colour.
    const colorNames = Object.keys(extend.colors);
    const clashes = Object.keys(extend.boxShadow).filter((name) => colorNames.includes(name));
    expect(clashes).toEqual([]);
  });

  // An entrance that keeps its last frame after it has played would hold its
  // transform over the element's own hover and press, so each one lets go.
  it.each(Object.entries(animations))('the %s entrance fills backwards', (_name, value) => {
    expect(value).toMatch(/ backwards$/);
  });

  // An animation that names a keyframe nobody defined is still emitted, and
  // plays nothing.
  it.each(Object.entries(animations))('the %s entrance names a keyframe that exists', (_name, value) => {
    expect(Object.keys(keyframes)).toContain(value.split(' ')[0]);
  });

  it('defines the animation that motion.ts hands out as the entrance', () => {
    // Renaming the key would leave `enter` naming a class Tailwind never emits.
    expect(Object.keys(animations).map((key) => `animate-${key}`)).toContain(enter);
  });
});
