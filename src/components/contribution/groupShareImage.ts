export const COLLECTIPAY_SHARE_HOST = "collectipay.com.ng";

export const sharePalettes = {
  emerald: { paper: "#092b24", surface: "#133d33", ink: "#f5fcf8", muted: "#bbd8cc", accent: "#ddf5b7", line: "#396359" },
  mint: { paper: "#edf7ee", surface: "#ffffff", ink: "#143a2d", muted: "#416456", accent: "#15684e", line: "#c1d9cb" },
  midnight: { paper: "#151e26", surface: "#222e37", ink: "#f4f9fb", muted: "#b7cbd2", accent: "#abe4e0", line: "#4b606a" },
};

export type GroupShareTheme = keyof typeof sharePalettes;
export type GroupShareFormat = "story" | "square";
type BankDetails = { number: string; bank: string; name: string };

export type GroupShareArtwork = {
  name: string;
  category: string;
  coverUrl?: string | null;
  joinLink?: string;
  bank?: BankDetails;
} & (
  | { kind: "bank"; bank: BankDetails }
  | { kind: "poster"; format: GroupShareFormat; theme: GroupShareTheme; description?: string; raised: number; target: number }
);

const WIDTH = 540;
const INSET = 30;
const CONTENT = WIDTH - INSET * 2;
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

async function loadArtwork(url?: string | null) {
  if (!url) return null;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  let timer: number | undefined;
  try {
    return await Promise.race([
      image.decode().then(() => image),
      new Promise<null>((resolve) => { timer = window.setTimeout(() => resolve(null), 8_000); }),
    ]);
  } catch { return null; }
  finally { window.clearTimeout(timer); }
}

export async function renderGroupShareImage(artwork: GroupShareArtwork) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable.");
  const [cover, mark] = await Promise.all([loadArtwork(artwork.coverUrl), loadArtwork("/collectipay-mark.svg")]);
  const palette = sharePalettes[artwork.kind === "bank" ? "emerald" : artwork.theme];
  const joinAddress = artwork.joinLink?.replace(/^https?:\/\//, "");

  const font = (size: number, weight: number) => `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
  const lines = (value: string, size: number, weight: number, width = CONTENT) => {
    ctx.font = font(size, weight);
    const output: string[] = [];
    let line = "";
    for (const word of value.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      line = "";
      for (const character of word) {
        if (line && ctx.measureText(line + character).width > width) {
          output.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) output.push(line);
    return output;
  };
  const text = (value: string, x: number, y: number, size: number, weight: number, color = palette.ink) => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  const round = (x: number, y: number, width: number, height: number, radius: number, color: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const drawMark = (x: number, y: number, size: number) => {
    if (mark) ctx.drawImage(mark, x, y, size, size);
    else {
      round(x, y, size, size, size / 2, "#198250");
      text("C", x + size * .25, y + size * .73, size * .68, 800, "#fff");
    }
  };

  const isStory = artwork.kind === "poster" && artwork.format === "story";
  const nameSize = artwork.kind === "bank" || isStory ? 37 : 30;
  const trimmedName = artwork.name.trim();
  const name = trimmedName.length > 180 ? `${trimmedName.slice(0, 179)}…` : trimmedName;
  const nameLines = lines(name, nameSize, 770);
  const bankNameLines = artwork.kind === "bank" ? lines(artwork.bank.bank, 21, 650, CONTENT - 36) : [];
  const accountNameLines = artwork.kind === "bank" ? lines(artwork.bank.name, 21, 650, CONTENT - 36) : [];
  const height = artwork.kind === "bank"
    ? 554 + nameLines.length * 43 + (bankNameLines.length + accountNameLines.length) * 28
    : isStory ? 960 : 540;
  canvas.width = WIDTH * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, WIDTH, height);

  const heroHeight = artwork.kind === "bank" ? 206 : isStory ? 466 : 176;
  const heroY = artwork.kind === "bank" ? 21 : 16;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(16, heroY, WIDTH - 32, heroHeight, 20);
  ctx.clip();
  const gradient = ctx.createLinearGradient(16, heroY, WIDTH - 16, heroY + heroHeight);
  gradient.addColorStop(0, "#104f42");
  gradient.addColorStop(1, "#082820");
  ctx.fillStyle = gradient;
  ctx.fillRect(16, heroY, WIDTH - 32, heroHeight);
  if (cover) {
    const scale = Math.max((WIDTH - 32) / cover.naturalWidth, heroHeight / cover.naturalHeight);
    const width = cover.naturalWidth * scale;
    const imageHeight = cover.naturalHeight * scale;
    ctx.drawImage(cover, (WIDTH - width) / 2, heroY + (heroHeight - imageHeight) / 2, width, imageHeight);
  } else {
    ctx.strokeStyle = "#c4f1d335";
    for (const radius of [69, 96, 125, 158, 193, 230]) {
      ctx.beginPath();
      ctx.arc(WIDTH * .73, heroY + heroHeight * .42, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = .75;
    const size = Math.min(104, heroHeight * .43);
    drawMark(WIDTH * .73 - size / 2, heroY + heroHeight * .42 - size / 2, size);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const badgeY = heroY + heroHeight - 43;
  round(29, badgeY, 172, 30, 15, "#072b24eb");
  drawMark(35, badgeY + 4, 22);
  text("Created with CollectiPay", 62, badgeY + 20, 11.5, 700, "#ffffff");

  let y = heroY + heroHeight + 33;
  text(artwork.kind === "bank" ? "GROUP BANK ACCOUNT" : artwork.category.toUpperCase(), INSET, y, 12, 760, palette.accent);
  const lineLimit = isStory ? 3 : 2;
  const fitTitle = artwork.kind === "poster" && nameLines.length > lineLimit;
  const compactTitle = fitTitle ? lines(name, 24, 770) : nameLines;
  const title = artwork.kind === "bank" ? compactTitle : compactTitle.slice(0, lineLimit);
  const titleSize = fitTitle ? 24 : nameSize;
  const titleStep = titleSize + 6;
  title.forEach((line, index) => {
    y += titleStep;
    text(artwork.kind === "poster" && index === lineLimit - 1 && compactTitle.length > lineLimit ? `${line.slice(0, -2)}…` : line, INSET, y, titleSize, 770);
  });
  y += 22;

  if (artwork.kind === "bank") {
    round(INSET, y, CONTENT, 88, 16, palette.surface);
    text("ACCOUNT NUMBER", INSET + 18, y + 24, 11, 740, palette.muted);
    text(artwork.bank.number, INSET + 18, y + 64, 33, 780);
    y += 103;
    for (const [label, valueLines] of [["BANK", bankNameLines], ["ACCOUNT NAME", accountNameLines]] as const) {
      const rowHeight = 39 + valueLines.length * 28;
      round(INSET, y, CONTENT, rowHeight, 14, palette.surface);
      text(label, INSET + 18, y + 21, 11, 740, palette.muted);
      valueLines.forEach((value, index) => text(value, INSET + 18, y + 49 + index * 28, 21, 650));
      y += rowHeight + 11;
    }
  } else {
    if (artwork.description && isStory) {
      const description = lines(artwork.description, 18, 500);
      description.slice(0, 2).forEach((line, index) => text(index === 1 && description.length > 2 ? `${line.slice(0, -2)}…` : line, INSET, y + 23 * index, 18, 500, palette.muted));
      y += Math.min(description.length, 2) * 23 + 9;
    }
    if (artwork.target > 0) {
      const progress = Math.max(0, Math.min(1, artwork.raised / artwork.target));
      text(`${naira.format(artwork.raised)} raised`, INSET, y + 12, 20, 740);
      text(`Goal ${naira.format(artwork.target)}`, INSET, y + 35, 14, 550, palette.muted);
      round(INSET, y + 47, CONTENT, 6, 3, palette.line);
      if (progress > 0) round(INSET, y + 47, CONTENT * progress, 6, 3, palette.accent);
      y += 67;
    }
    if (artwork.bank) {
      const summary = [artwork.bank.bank, artwork.bank.name].map((value) => {
        const wrapped = lines(value, 13, 550, CONTENT - 28);
        return wrapped.length > 1 ? `${wrapped[0].slice(0, -2)}…` : wrapped[0] || "";
      });
      round(INSET, y, CONTENT, 77, 13, palette.surface);
      text("DIRECT BANK TRANSFER", INSET + 14, y + 17, 10, 740, palette.muted);
      text(artwork.bank.number, INSET + 14, y + 38, 20, 750);
      summary.forEach((line, index) => text(line, INSET + 14, y + 55 + index * 15, 13, 550, palette.muted));
    }
  }

  ctx.fillStyle = palette.line;
  const footerOffset = joinAddress ? 9 : 0;
  ctx.fillRect(INSET, height - 57 - footerOffset, CONTENT, 1);
  drawMark(INSET, height - 43 - footerOffset, 28);
  text("CollectiPay", INSET + 36, height - 24 - footerOffset, 15, 750);
  ctx.textAlign = "right";
  text(COLLECTIPAY_SHARE_HOST, WIDTH - INSET, height - 24 - footerOffset, 15, 690, palette.accent);
  ctx.textAlign = "left";
  if (joinAddress) {
    ctx.font = font(11, 550);
    ctx.fillStyle = palette.muted;
    ctx.fillText(joinAddress, INSET, height - 12, CONTENT);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image export failed.")), "image/png");
  });
  const filename = artwork.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 64) || "group";
  return { canvas, file: new File([blob], `collectipay-${filename}-${artwork.kind === "bank" ? "bank-card" : artwork.format}.png`, { type: blob.type }) };
}
