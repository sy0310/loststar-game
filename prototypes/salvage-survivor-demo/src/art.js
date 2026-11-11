(function (root) {
  "use strict";
  const catalog = root.SurvivorArtCatalog;
  const images = new Map();
  const flashes = new Map();

  async function load() {
    await Promise.all(
      Object.entries(catalog).map(async ([id, entry]) => {
        const image = new Image();
        image.src = entry.src;
        await image.decode();
        if (
          image.naturalWidth !== entry.nativeSize[0] * 2 ||
          image.naturalHeight !== entry.nativeSize[1] * 2
        ) {
          throw Error("素材尺寸不符 " + id);
        }
        images.set(id, image);
        if (entry.kind === "actor") {
          const white = document.createElement("canvas");
          white.width = image.width;
          white.height = image.height;
          const ctx = white.getContext("2d");
          ctx.drawImage(image, 0, 0);
          ctx.globalCompositeOperation = "source-in";
          ctx.fillStyle = "#fff5df";
          ctx.fillRect(0, 0, white.width, white.height);
          flashes.set(id, white);
        }
      }),
    );
  }

  function draw(ctx, id, x, y, options = {}) {
    const entry = catalog[id],
      image = images.get(id);
    if (!entry || !image) return;
    const frameIndex = options.frame ?? 0;
    const frame = entry.frames[frameIndex % entry.frames.length];
    const scale = options.scale ?? 2;
    const anchor = options.anchor ?? frame.anchor;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (options.angle) ctx.rotate(options.angle);
    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
    const args = [
      frame.x * 2,
      frame.y * 2,
      frame.width * 2,
      frame.height * 2,
      -anchor[0] * scale,
      -anchor[1] * scale,
      frame.width * scale,
      frame.height * scale,
    ];
    ctx.drawImage(image, ...args);
    if (options.flash && flashes.has(id)) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(flashes.get(id), ...args);
    }
    ctx.restore();
  }

  function icon(id, size = 32) {
    const entry = catalog[id] || catalog.armor;
    return (
      '<img src="' +
      entry.src +
      '" width="' +
      size +
      '" height="' +
      size +
      '" alt="" aria-hidden="true">'
    );
  }

  root.SurvivorArt = { load, draw, icon, catalog, loaded: () => images.size };
})(window);
