type ExportRow = { label: string; value: string; highlight?: boolean };

export async function renderReceiptImage(receipt: {
  title: string;
  amount: string;
  status: string;
  tone: "success" | "pending" | "failed";
  rows: ExportRow[];
}) {
  const width = 464;
  const inset = 24;
  const contentWidth = width - inset * 2;
  const labelWidth = 104;
  const valueWidth = contentWidth - labelWidth - 16;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Receipt image rendering is unavailable.");

  const font = (size: number, weight = 500) => `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
  const wrap = (value: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      if (context.measureText(line ? line + " " + word : word).width <= maxWidth) {
        line += (line ? " " : "") + word;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of word) {
        if (line && context.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const rows = receipt.rows.map((row) => {
    context.font = font(13, 600);
    const labelLines = wrap(row.label, labelWidth);
    context.font = font(14, 650);
    const lines = wrap(row.value, valueWidth);
    return { ...row, labelLines, lines, height: 15 + Math.max(1, labelLines.length, lines.length) * 18 };
  });
  context.font = font(15, 650);
  const titleLines = wrap(receipt.title, contentWidth);
  const headerHeight = 143 + Math.max(0, titleLines.length - 1) * 19;
  const height = headerHeight + 15 + rows.reduce((sum, row) => sum + row.height, 0) + 40;
  const scale = Math.min(3, 14000 / height);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  context.scale(scale, scale);
  context.textBaseline = "middle";
  const drawText = (value: string, x: number, y: number, size: number, weight: number, color: string) => {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.fillText(value, x, y);
  };

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, headerHeight);
  gradient.addColorStop(0, "#0a2c23");
  gradient.addColorStop(1, "#145441");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, headerHeight);
  context.strokeStyle = "#c4f1d329";
  for (const radius of [39, 60, 81]) {
    context.beginPath();
    context.arc(width - 10, 12, radius, 0, Math.PI * 2);
    context.stroke();
  }

  const mark = new Image();
  mark.src = "/collectipay-mark.svg";
  const paper = new Image();
  paper.src = "/images/collectipay-receipt-pattern.svg";
  await Promise.allSettled([mark.decode(), paper.decode()]);
  if (mark.naturalWidth) {
    context.save();
    context.beginPath();
    context.rect(0, 0, width, headerHeight);
    context.clip();
    context.globalAlpha = .27;
    context.translate(width - 38, 63);
    context.rotate(-Math.PI / 15);
    context.drawImage(mark, -99, -99, 198, 198);
    context.restore();
    context.drawImage(mark, 23, 15, 32, 32);
  }
  drawText("CollectiPay", 61, 32, 19, 750, "#ffffff");
  context.font = font(13, 700);
  const pillWidth = context.measureText(receipt.status).width + 23;
  const pillX = width - inset - pillWidth;
  const palette = receipt.tone === "success" ? ["#dff4c4", "#194431"]
    : receipt.tone === "failed" ? ["#ffdbdb", "#701f27"] : ["#fff0bb", "#674603"];
  context.fillStyle = palette[0];
  context.beginPath();
  context.roundRect(pillX, 18, pillWidth, 26, 13);
  context.fill();
  drawText(receipt.status, pillX + 11, 32, 13, 700, palette[1]);
  titleLines.forEach((line, index) => drawText(line, inset, 71 + index * 19, 15, 650, "#c2e6d6"));
  let amountSize = 42;
  context.font = font(amountSize, 800);
  while (amountSize > 18 && context.measureText(receipt.amount).width > contentWidth) {
    context.font = font(--amountSize, 800);
  }
  drawText(receipt.amount, inset, headerHeight - 31, amountSize, 800, "#ffffff");
  context.fillStyle = "#dbf5b4";
  context.fillRect(inset, headerHeight - 2, 42, 2);

  const footerHeight = 36;
  const watermark = paper.naturalWidth ? context.createPattern(paper, "repeat") : null;
  if (watermark) {
    context.save();
    context.translate(0, headerHeight);
    context.fillStyle = watermark;
    context.fillRect(0, 0, width, height - headerHeight - footerHeight);
    context.restore();
  }

  let y = headerHeight + 8;
  for (const row of rows) {
    row.labelLines.forEach((line, index) => drawText(line, inset, y + 16 + index * 18, 13, 600, "#526e63"));
    row.lines.forEach((line, index) =>
      drawText(line, inset + labelWidth + 16, y + 16 + index * 18, 14, 650, row.highlight ? "#116648" : "#142e24"),
    );
    y += row.height;
    context.fillStyle = "#e2ede6";
    context.fillRect(inset, y, contentWidth, 1);
  }
  context.fillStyle = "#f0f7f3";
  context.fillRect(0, height - footerHeight, width, footerHeight);
  drawText(receipt.tone === "success" ? "Verified by CollectiPay" : "CollectiPay transaction record", inset, height - 18, 12, 650, "#325b49");
  return canvas;
}
