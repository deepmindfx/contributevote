type ExportRow = { label: string; value: string; highlight?: boolean };

export function renderReceiptImage(receipt: {
  title: string;
  amount: string;
  status: string;
  tone: "success" | "pending" | "failed";
  rows: ExportRow[];
}) {
  const width = 464;
  const inset = 28;
  const contentWidth = width - inset * 2;
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

  context.font = font(15, 650);
  const rows = receipt.rows.map((row) => ({ ...row, lines: wrap(row.value, contentWidth) }));
  context.font = font(16, 650);
  const titleLines = wrap(receipt.title, contentWidth);
  const headerHeight = 170 + Math.max(0, titleLines.length - 1) * 22;
  const height = headerHeight + 30 + rows.reduce((sum, row) => sum + 43 + row.lines.length * 22, 0) + 44;
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

  context.fillStyle = "#b9e9c8";
  context.beginPath();
  context.arc(45, 40, 17, 0, Math.PI * 2);
  context.fill();
  drawText("C", 37, 41, 22, 800, "#10382b");
  drawText("CollectiPay", 72, 39, 22, 750, "#ffffff");
  context.font = font(13, 700);
  const labelWidth = context.measureText(receipt.status).width + 26;
  const pillX = width - inset - labelWidth;
  const palette = receipt.tone === "success" ? ["#dff4c4", "#194431"]
    : receipt.tone === "failed" ? ["#ffdbdb", "#701f27"] : ["#fff0bb", "#674603"];
  context.fillStyle = palette[0];
  context.beginPath();
  context.roundRect(pillX, 25, labelWidth, 30, 15);
  context.fill();
  drawText(receipt.status, pillX + 13, 41, 13, 700, palette[1]);
  titleLines.forEach((line, index) => drawText(line, inset, 89 + index * 22, 16, 650, "#c2e6d6"));
  let amountSize = 45;
  context.font = font(amountSize, 800);
  while (amountSize > 18 && context.measureText(receipt.amount).width > contentWidth) {
    context.font = font(--amountSize, 800);
  }
  drawText(receipt.amount, inset, headerHeight - 37, amountSize, 800, "#ffffff");

  let y = headerHeight + 24;
  for (const row of rows) {
    drawText(row.label, inset, y + 9, 13, 650, "#526e63");
    row.lines.forEach((line, index) =>
      drawText(line, inset, y + 31 + index * 22, 15, 650, row.highlight ? "#116648" : "#142e24"),
    );
    y += 43 + row.lines.length * 22;
    context.fillStyle = "#e2ede6";
    context.fillRect(inset, y - 9, contentWidth, 1);
  }
  context.fillStyle = "#f0f7f3";
  context.fillRect(0, height - 44, width, 44);
  drawText("CollectiPay transaction record", inset, height - 22, 13, 650, "#325b49");
  return canvas;
}
