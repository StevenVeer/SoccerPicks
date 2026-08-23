const INTRO_DUR = 600;
const PICK_STEP = 650;
const PICK_ANIM = 450;
const START_HOLD = 100;
const ANIMATION_SPEED = 2;
const MIN_VIDEO_DUR = 8000;

export function timeline(pickCount) {
  const picksEnd = INTRO_DUR + Math.max(0, pickCount - 1) * PICK_STEP + PICK_ANIM;
  const parlayStart = picksEnd + 350;
  const parlayAnim = 500;
  const hold = 350;
  const outroStart = parlayStart + parlayAnim + hold;
  const outroAnim = 450;
  const animationTotal = outroStart + outroAnim + 700;

  return {
    startHold: START_HOLD,
    animationSpeed: ANIMATION_SPEED,
    introDur: INTRO_DUR,
    pickStep: PICK_STEP,
    pickAnim: PICK_ANIM,
    picksEnd,
    parlayStart,
    parlayAnim,
    outroStart,
    outroAnim,
    animationTotal,
    total: Math.max(animationTotal, MIN_VIDEO_DUR),
  };
}
