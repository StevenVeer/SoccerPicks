const INTRO_DUR = 600;
const PICK_STEP = 650;
const PICK_ANIM = 450;

export function timeline(pickCount) {
  const picksEnd = INTRO_DUR + Math.max(0, pickCount - 1) * PICK_STEP + PICK_ANIM;
  const parlayStart = picksEnd + 350;
  const parlayAnim = 500;
  const hold = 2800;
  const outroStart = parlayStart + parlayAnim + hold;
  const outroAnim = 450;
  const total = outroStart + outroAnim + 700;

  return {
    introDur: INTRO_DUR,
    pickStep: PICK_STEP,
    pickAnim: PICK_ANIM,
    picksEnd,
    parlayStart,
    parlayAnim,
    outroStart,
    outroAnim,
    total,
  };
}
