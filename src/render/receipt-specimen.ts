/** D1-only paper rig. Every band shares its boundary with its neighbours. */
const BAND_COUNT = 9;
const TEXTURE_SIZE = 256;
const TRANSITION_SECONDS = 1;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function fitReceiptSpecimen(width: number, height: number, frame: number) {
  const scale = frame / Math.max(width, height);
  return {
    left: -width * scale / 2,
    top: -height * scale / 2,
    width: width * scale,
    height: height * scale,
    scale,
  };
}

type RigOptions = {
  frame: number;
  paperWidth: number;
  hingeV: number;
  curlV: number;
  reveal: number;
};

export function receiptPaperRig(seconds: number, options: RigOptions) {
  const {frame, paperWidth, hingeV, curlV, reveal} = options;
  const horizontalRoom = Math.max(0, (frame - paperWidth) / 2 - .1);
  const unfold = Math.sin(Math.PI * clamp(reveal));
  const nodes = Array.from({length: BAND_COUNT + 1}, (_, index) => {
    if (index === 0) return {x: 0, y: -frame / 2};
    if (index === BAND_COUNT) return {x: 0, y: frame / 2};
    const v = index / BAND_COUNT;
    const body = (v - hingeV) * Math.sin(Math.PI * v);
    const curl = smooth((v - curlV) / (1 - curlV)) * (1 - v) * 6;
    const displacement = body * Math.sin(seconds * .85) * 1.2
      + curl * (Math.sin(seconds * 1.35 - .8) * 1.1 + unfold * .9);
    return {
      x: Math.max(-horizontalRoom, Math.min(horizontalRoom, displacement)),
      y: (v - .5) * frame + body * Math.sin(seconds * .9 - .3) * .45,
    };
  });
  return {nodes};
}

export type ReceiptTransition = {
  level: number;
  fromLevel: number;
  since: number;
  lastSeconds: number;
  mix: number;
};

export function advanceReceiptTransition(
  previous: ReceiptTransition | undefined,
  level: number,
  seconds: number,
  installation = 1,
): ReceiptTransition {
  if (!previous || seconds < previous.lastSeconds) {
    return {level, fromLevel: level, since: seconds, lastSeconds: seconds, mix: 1};
  }
  if (previous.level !== level) {
    return {
      level,
      fromLevel: previous.mix >= .5 ? previous.level : previous.fromLevel,
      since: seconds,
      lastSeconds: seconds,
      mix: 0,
    };
  }
  const mix = Math.min(smooth((seconds - previous.since) / TRANSITION_SECONDS), clamp(installation));
  return {...previous, fromLevel: mix === 1 ? level : previous.fromLevel, lastSeconds: seconds, mix};
}

export function receiptRevealAt(progress: number, v: number) {
  return smooth((clamp(progress) - clamp(v) * .45) / .55);
}

export type ReceiptSpecimenAssets = {
  specimen0: HTMLImageElement;
  specimen1: HTMLImageElement;
  specimen2: HTMLImageElement;
  specimen3: HTMLImageElement;
};

export type PaperRect = {x: number; y: number; width: number; height: number};
type TierRegistration = {
  file: string;
  alphaBounds: {visible16: PaperRect};
  paperFace: PaperRect;
  inkStrip: PaperRect;
  returnStamp: PaperRect;
  lowerCurl: PaperRect;
  hingeUv: {x: number; y: number};
};
type SpecimenRegistration = {
  receipts: {
    tiers: TierRegistration[];
    common: {
      hingeUv: {x: number; y: number};
      vaultEmitters?: PaperRect[];
    };
  };
};

const imageUrls = import.meta.glob('../../assets/runtime/d1-refinement/receipt-tier-*.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const registrationFiles = import.meta.glob('../../assets/runtime/d1-refinement/registration.json', {
  eager: true, import: 'default',
}) as Record<string, SpecimenRegistration>;

export function createReceiptSpecimenAssets(): ReceiptSpecimenAssets {
  const load = (tier: number) => {
    const path = `../../assets/runtime/d1-refinement/receipt-tier-${tier}.webp`;
    const url = imageUrls[path];
    if (!url) throw new Error(`Missing D1 receipt specimen tier ${tier}`);
    const image = new Image();
    image.src = url;
    return image;
  };
  return {specimen0: load(0), specimen1: load(1), specimen2: load(2), specimen3: load(3)};
}

export function receiptSpecimenRegistration() {
  const registration = registrationFiles['../../assets/runtime/d1-refinement/registration.json'];
  if (!registration) throw new Error('Missing D1 receipt specimen registration');
  return registration.receipts;
}
