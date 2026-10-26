// Small articulated pixel figures use the same facing, strike and movement timing
// as the atlas characters. All geometry is original and stays crisp at game scale.
export const NEW_FUSIONS = ["phoenix", "terraformer", "sanctuary"];
export const NEW_PARTS = {
  phoenix: ["air", "fire", "light"],
  terraformer: ["air", "dark", "earth"],
  sanctuary: ["earth", "light", "water"],
};
export function drawFusionArt(c, a, time, pose) {
  const phoenix = a.element === "phoenix",
    terra = a.element === "terraformer";
  const back = pose.facing === 2,
    side = pose.facing === 1;
  const stride = pose.sidestepping
    ? pose.stepFrame % 2
      ? -1
      : 1
    : pose.running && pose.runFrame !== null
      ? pose.runFrame % 2
        ? -1
        : 1
      : 0;
  const attack =
    pose.progress >= 0
      ? Math.sin(pose.progress * Math.PI)
      : a.clash > 0
        ? 0.8
        : 0;
  const lift = a.victory ? 6 : attack * 4;
  const dark = "#18232b",
    mid = phoenix ? "#ea6d28" : terra ? "#776c82" : "#339354";
  const bright = phoenix ? "#ffe8a2" : terra ? "#b9b0be" : "#9de3a5";
  const accent = phoenix ? "#fff5d6" : terra ? "#ac83ef" : "#83eff1";
  c.save();
  if (pose.flip) c.scale(-1, 1);
  if (pose.reacting) {
    const r = Math.sin((1 - a.hitReact / 0.24) * Math.PI);
    c.translate((a.hitDx || 0) * r * 8, -r * 3);
    c.rotate((a.hitDx || 0) * r * 0.1);
  }
  c.scale(2, 2);
  const px = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const polygon = (points, color) => {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? c.lineTo(Math.round(x), Math.round(y))
        : c.moveTo(Math.round(x), Math.round(y)),
    );
    c.closePath();
    c.fill();
  };
  // A flame-winged knight, a floating stone warden, and an emerald spring guardian.
  if (phoenix) {
    const flap = Math.sin(time * 4) * 2 - lift;
    for (const sign of [-1, 1]) {
      c.save();
      c.scale(sign, 1);
      polygon(
        [
          [5, -22],
          [12, -25 + flap],
          [20, -29 + flap],
          [17, -18],
          [21, -15],
          [15, -15],
          [17, -10],
          [9, -14],
          [6, -9],
        ],
        "#8d3424",
      );
      polygon(
        [
          [7, -22],
          [19, -27 + flap],
          [15, -17],
          [18, -15],
          [12, -15],
          [13, -11],
          [7, -15],
        ],
        "#f7b638",
      );
      polygon(
        [
          [8, -21],
          [16, -24 + flap],
          [12, -17],
          [10, -15],
          [7, -17],
        ],
        "#fff2c5",
      );
      c.restore();
    }
  } else {
    polygon(
      [
        [-7, -24],
        [7, -24],
        [side ? 9 : 12, 0],
        [-11, 0],
      ],
      dark,
    );
    polygon(
      [
        [-6, -23],
        [6, -23],
        [side ? 7 : 10, -1],
        [-9, -1],
      ],
      terra ? "#3e354e" : "#246d45",
    );
    px(-7, -18, 2, 14, bright);
    px(7, -17, 2, 15, mid);
    if (back) {
      px(-2, -23, 4, 18, terra ? "#93869e" : "#64c58b");
      px(-4, -14, 8, 2, accent);
    }
  }
  // Alternating boots also serve as a restrained target-locked sidestep.
  px(-6, -5 + stride, 5, 7, dark);
  px(2, -5 - stride, 5, 7, dark);
  px(-7, -1 + stride, 6, 3, terra ? "#aaa18f" : mid);
  px(2, -1 - stride, 6, 3, terra ? "#aaa18f" : mid);
  px(-7, -22, 14, 18, dark);
  px(-6, -21, 12, 16, mid);
  px(-4, -19, 8, 8, bright);
  px(-3, -18, 6, 6, terra ? "#5b5368" : mid);
  px(-6, -9, 12, 3, terra ? "#3b304a" : "#735a30");
  px(-1, -9, 3, 3, accent);
  if (!back) {
    px(-1, -17, 2, 6, accent);
    px(-3, -15, 6, 2, accent);
  }
  // Shoulder plates and distinct hands; the striking arm extends at contact.
  const reach = attack * 6,
    armY = -18 - lift;
  px(-10, -22, 5, 5, dark);
  px(-9, -21, 4, 3, bright);
  px(-10, -17 - lift / 2, 4, 9, dark);
  px(-9, -16 - lift / 2, 3, 6, mid);
  px(side ? 4 : 6, armY, 5 + reach, 5, dark);
  px(side ? 5 : 7, armY + 1, 3 + reach, 3, bright);
  px((side ? 5 : 7) + reach, armY + 4, 4, 5, mid);
  if (terra) {
    // Rock gauntlets and three small amethyst seams.
    px(-12, -13 - lift / 2, 7, 6, "#544c57");
    px(-11, -12 - lift / 2, 5, 3, "#b7aa93");
    px(6 + reach, armY + 3, 7, 6, "#544c57");
    px(7 + reach, armY + 4, 5, 3, "#b7aa93");
    for (let i = 0; i < 3; i++) px(7 + reach + i * 2, armY + 3, 1, 5, accent);
  } else {
    const staffX = 11 + reach,
      staffTop = -31 - lift;
    px(staffX, -22 - lift, 2, 24, "#423b32");
    px(staffX, staffTop, 2, 12, bright);
    polygon(
      [
        [staffX - 2, staffTop + 2],
        [staffX + 1, staffTop - 4],
        [staffX + 4, staffTop + 2],
        [staffX + 1, staffTop + 6],
      ],
      accent,
    );
    px(staffX - 2, -22 - lift, 7, 2, bright);
  }
  // Front, profile and back heads have different outlines and facial visibility.
  const hx = side ? 1 : 0;
  px(hx - 7, -32, 14, 13, dark);
  px(hx - 6, -31, 12, 11, bright);
  if (terra) {
    px(hx - 7, -33, 4, 4, "#8d8296");
    px(hx + 3, -33, 4, 4, "#8d8296");
    px(hx - 5, -30, 10, 10, "#3b344b");
    if (!back) {
      px(hx + (side ? 2 : -4), -27, side ? 3 : 8, 2, accent);
      px(hx - 3, -23, 7, 2, "#73647d");
    } else {
      px(hx - 4, -29, 8, 2, "#776b83");
      px(hx - 1, -28, 2, 7, accent);
    }
  } else if (phoenix) {
    polygon(
      [
        [hx - 5, -31],
        [hx - 2, -38],
        [hx, -34],
        [hx + 3, -37],
        [hx + 5, -31],
      ],
      "#f9862c",
    );
    px(hx - 1, -35, 2, 5, "#fff4b3");
    px(hx - 4, -28, 9, 7, back ? "#dba756" : "#d79855");
    if (!back) {
      px(hx + (side ? 2 : -3), -27, side ? 3 : 7, 2, "#3f2927");
      px(hx + 3, -27, 2, 1, "#fff9df");
      px(hx - 2, -23, 6, 2, "#ffebae");
    }
  } else {
    // Green scaled face, cream Light mantle and a water-blue crest.
    px(hx - 5, -29, 10, 9, "#64bd74");
    px(hx - 4, -29, 3, 3, "#b0eba7");
    if (!back) {
      px(hx + (side ? 2 : -4), -27, side ? 3 : 8, 2, "#17382e");
      px(hx + (side ? 3 : -3), -27, 1, 1, "#e8f8bc");
      px(hx + 3, -27, 1, 1, "#e8f8bc");
      px(hx - 2, -23, 6, 2, "#a1d381");
    } else {
      px(hx - 2, -29, 4, 9, "#348f59");
      px(hx - 1, -29, 2, 7, accent);
    }
    px(hx - 3, -33, 6, 2, accent);
    px(hx - 1, -35, 2, 3, "#dffff4");
  }
  if (a.victory) {
    for (let i = 0; i < 3; i++) px(-9 + i * 9, -38 - (i % 2) * 3, 2, 2, accent);
  }
  if (a.spawnFlash > 0) {
    c.globalAlpha *= Math.max(0, Math.sin(a.spawnFlash * 20)) * 0.5;
    px(-6, -31, 12, 27, "#fff8dc");
  }
  c.restore();
  return true;
}
