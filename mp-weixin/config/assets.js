/**
 * 本地打包素材：路径必须是完整字面量。
 * 禁止把目录前缀和文件名拼起来——上传依赖分析收不到拼接路径，
 * 体验版/开发版真机会变成黑心、木鱼消失。
 */
const BG = "/assets/bg-zen.jpg";
const SHARE = "/assets/share-cover.jpg";

const UI = {
  data: "/assets/ui/rail-data.png",
  reset: "/assets/ui/rail-reset.png",
  auto: "/assets/ui/rail-auto.png",
};

const SFX = {
  muyu: "/assets/sfx/muyu.wav",
  beads: "/assets/sfx/beads.wav",
  bowl: "/assets/sfx/bowl.wav",
};

const SKINS = {
  muyu: [
    {
      id: "amber",
      name: "樟木",
      free: true,
      premium: true,
      body: "/assets/skins/premium/muyu-premium-body.png",
      shade: "/assets/skins/premium/muyu-premium-shade.png",
      spec: "/assets/skins/premium/muyu-premium-spec.png",
      ground: "/assets/skins/premium/muyu-premium-ground.png",
      rim: "/assets/skins/premium/muyu-premium-rim.png",
      mallet: "/assets/skins/premium/muyu-premium-mallet.png",
    },
    {
      id: "jade",
      name: "花梨",
      free: true,
      premium: true,
      body: "/assets/skins/premium/muyu-premium-jade-body.png",
      shade: "/assets/skins/premium/muyu-premium-jade-shade.png",
      spec: "/assets/skins/premium/muyu-premium-jade-spec.png",
      ground: "/assets/skins/premium/muyu-premium-jade-ground.png",
      rim: "/assets/skins/premium/muyu-premium-jade-rim.png",
      mallet: "/assets/skins/premium/muyu-premium-jade-mallet.png",
    },
    {
      id: "inkgold",
      name: "紫檀",
      free: false,
      premium: true,
      body: "/assets/skins/premium/muyu-premium-inkgold-body.png",
      shade: "/assets/skins/premium/muyu-premium-inkgold-shade.png",
      spec: "/assets/skins/premium/muyu-premium-inkgold-spec.png",
      ground: "/assets/skins/premium/muyu-premium-inkgold-ground.png",
      rim: "/assets/skins/premium/muyu-premium-inkgold-rim.png",
      mallet: "/assets/skins/premium/muyu-premium-inkgold-mallet.png",
    },
  ],
  beads: [
    { id: "wood", name: "檀木", free: true, bead: "/assets/skins/bead-wood.png" },
    { id: "jade", name: "青玉", free: true, bead: "/assets/skins/bead-jade.png" },
    { id: "rosewood", name: "紫檀", free: false, bead: "/assets/skins/bead-rosewood.png" },
  ],
  bowl: [
    {
      id: "brass",
      name: "黄铜",
      free: true,
      body: "/assets/skins/bowl-brass.png",
      mallet: "/assets/skins/bowl-mallet-brass.png",
    },
    {
      id: "gold",
      name: "鎏金",
      free: true,
      body: "/assets/skins/bowl-gold.png",
      mallet: "/assets/skins/bowl-mallet-gold.png",
    },
    {
      id: "iron",
      name: "乌金",
      free: false,
      body: "/assets/skins/bowl-iron.png",
      mallet: "/assets/skins/bowl-mallet-iron.png",
    },
  ],
};

const AMBER = SKINS.muyu[0];
const WOOD_BEAD = SKINS.beads[0];
const BRASS = SKINS.bowl[0];

const DEFAULT_VIEW = {
  bgSrc: BG,
  railData: UI.data,
  railReset: UI.reset,
  railAuto: UI.auto,
  muyuBody: AMBER.body,
  muyuMallet: AMBER.mallet,
  muyuShade: AMBER.shade,
  muyuSpec: AMBER.spec,
  muyuGround: AMBER.ground,
  muyuRim: AMBER.rim,
  bowlBody: BRASS.body,
  bowlMallet: BRASS.mallet,
  beadSrc: WOOD_BEAD.bead,
};

function collectLocalPaths() {
  const out = [BG, SHARE, UI.data, UI.reset, UI.auto, SFX.muyu, SFX.beads, SFX.bowl];
  ["muyu", "beads", "bowl"].forEach((kind) => {
    SKINS[kind].forEach((s) => {
      ["body", "shade", "spec", "ground", "rim", "mallet", "bead"].forEach((k) => {
        if (s[k]) out.push(s[k]);
      });
    });
  });
  return out;
}

module.exports = {
  BG,
  SHARE,
  UI,
  SFX,
  SKINS,
  DEFAULT_VIEW,
  collectLocalPaths,
};
