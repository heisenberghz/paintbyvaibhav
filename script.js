const canvas = document.getElementById("paintCanvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const previewCanvas = document.getElementById("previewCanvas");
const previewContext = previewCanvas.getContext("2d");

const primaryColorPicker = document.getElementById("primaryColorPicker");
const secondaryColorPicker = document.getElementById("secondaryColorPicker");
const swapColorsButton = document.getElementById("swapColorsButton");
const sizeSlider = document.getElementById("sizeSlider");
const sizeValue = document.getElementById("sizeValue");
const fillShapeToggle = document.getElementById("fillShapeToggle");
const statusText = document.getElementById("statusText");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const clearButton = document.getElementById("clearButton");
const downloadButton = document.getElementById("downloadButton");
const toolName = document.getElementById("toolName");
const toolHint = document.getElementById("toolHint");
const primaryColorLabel = document.getElementById("primaryColorLabel");
const secondaryColorLabel = document.getElementById("secondaryColorLabel");
const footerTool = document.getElementById("footerTool");
const footerColors = document.getElementById("footerColors");
const footerHint = document.getElementById("footerHint");

const toolButtons = document.querySelectorAll(".tool-button");
const swatches = document.querySelectorAll(".swatch");
const sizeChips = document.querySelectorAll(".size-chip");

const toolMeta = {
  pencil: {
    label: "Pencil",
    hint: "Fine line drawing for precise sketching.",
  },
  brush: {
    label: "Brush",
    hint: "Smooth stroke for everyday painting and notes.",
  },
  eraser: {
    label: "Eraser",
    hint: "Remove parts of the drawing with the current brush size.",
  },
  spray: {
    label: "Airbrush",
    hint: "Soft dotted spray for texture and shading effects.",
  },
  fill: {
    label: "Fill",
    hint: "Flood an enclosed area with the active color.",
  },
  eyedropper: {
    label: "Pick Color",
    hint: "Sample an existing pixel from the canvas.",
  },
  line: {
    label: "Line",
    hint: "Create crisp straight lines with live preview.",
  },
  rectangle: {
    label: "Rectangle",
    hint: "Draw sharp rectangular shapes.",
  },
  "rounded-rectangle": {
    label: "Round Rect",
    hint: "A softer rectangle that feels more polished.",
  },
  circle: {
    label: "Ellipse",
    hint: "Draw circles and ellipses by dragging a frame.",
  },
  triangle: {
    label: "Triangle",
    hint: "Quick geometric triangle tool.",
  },
  arrow: {
    label: "Arrow",
    hint: "Directional arrow for diagrams and callouts.",
  },
};

const shapeTools = new Set([
  "line",
  "rectangle",
  "rounded-rectangle",
  "circle",
  "triangle",
  "arrow",
]);

const state = {
  drawing: false,
  tool: "pencil",
  primaryColor: primaryColorPicker.value.toUpperCase(),
  secondaryColor: secondaryColorPicker.value.toUpperCase(),
  activeColorKey: "primaryColor",
  lineWidth: Number(sizeSlider.value),
  fillShape: fillShapeToggle.checked,
  history: [],
  redoStack: [],
  maxHistory: 50,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
};

function fillBackground() {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function saveSnapshot() {
  if (state.history.length >= state.maxHistory) {
    state.history.shift();
  }

  state.history.push(context.getImageData(0, 0, canvas.width, canvas.height));
  state.redoStack = [];
  updateActionButtons();
}

function restoreSnapshot(snapshot) {
  context.putImageData(snapshot, 0, 0);
}

function updateActionButtons() {
  undoButton.disabled = state.history.length <= 1;
  redoButton.disabled = state.redoStack.length === 0;
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: Math.max(0, Math.min(canvas.width - 1, (event.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height - 1, (event.clientY - rect.top) * scaleY)),
  };
}

function getActiveColor() {
  return state[state.activeColorKey];
}

function setActiveColorFromButton(event) {
  state.activeColorKey = event.button === 2 ? "secondaryColor" : "primaryColor";
}

function updateSwatchSelection() {
  swatches.forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color.toUpperCase() === state.primaryColor);
  });
}

function updateSizeChips() {
  sizeChips.forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.size) === state.lineWidth);
  });
}

function updateColorReadout() {
  primaryColorPicker.value = state.primaryColor;
  secondaryColorPicker.value = state.secondaryColor;
  primaryColorLabel.textContent = state.primaryColor;
  secondaryColorLabel.textContent = state.secondaryColor;
  primaryColorLabel.style.setProperty("--live-color", state.primaryColor);
  secondaryColorLabel.style.setProperty("--live-color", state.secondaryColor);
  footerColors.textContent = `Colors: ${state.primaryColor} / ${state.secondaryColor}`;
  updateSwatchSelection();
}

function updateStatus() {
  const meta = toolMeta[state.tool];
  const fillText = shapeTools.has(state.tool) ? `, ${state.fillShape ? "filled" : "outline"}` : "";
  statusText.textContent = `${meta.label} ready - ${state.lineWidth}px${fillText}`;
  toolName.textContent = meta.label;
  toolHint.textContent = meta.hint;
  footerTool.textContent = `Tool: ${meta.label}`;
  footerHint.textContent = shapeTools.has(state.tool)
    ? `Shape mode: ${state.fillShape ? "filled" : "outline"}`
    : meta.hint;
}

function setTool(tool) {
  state.tool = tool;
  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  updateStatus();
}

function applyStrokeSettings(target, color, width = state.lineWidth) {
  target.lineCap = state.tool === "pencil" ? "square" : "round";
  target.lineJoin = "round";
  target.lineWidth = width;
  target.strokeStyle = color;
  target.fillStyle = color;
}

function drawBrushStroke(target, x, y) {
  target.lineTo(x, y);
  target.stroke();
}

function sprayAt(x, y, color) {
  const density = Math.max(14, state.lineWidth * 2);
  context.save();
  context.fillStyle = color;

  for (let index = 0; index < density; index += 1) {
    const radius = Math.random() * (state.lineWidth * 1.15);
    const angle = Math.random() * Math.PI * 2;
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius;
    const dotSize = Math.max(1, state.lineWidth / 7);
    context.fillRect(x + offsetX, y + offsetY, dotSize, dotSize);
  }

  context.restore();
}

function roundedRectPath(target, x, y, width, height, radius) {
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const rectWidth = Math.abs(width);
  const rectHeight = Math.abs(height);
  const safeRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);
  const right = left + rectWidth;
  const bottom = top + rectHeight;

  target.moveTo(left + safeRadius, top);
  target.lineTo(right - safeRadius, top);
  target.quadraticCurveTo(right, top, right, top + safeRadius);
  target.lineTo(right, bottom - safeRadius);
  target.quadraticCurveTo(right, bottom, right - safeRadius, bottom);
  target.lineTo(left + safeRadius, bottom);
  target.quadraticCurveTo(left, bottom, left, bottom - safeRadius);
  target.lineTo(left, top + safeRadius);
  target.quadraticCurveTo(left, top, left + safeRadius, top);
}

function arrowPath(target, startX, startY, endX, endY) {
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLength = Math.max(16, state.lineWidth * 2.6);

  target.moveTo(startX, startY);
  target.lineTo(endX, endY);
  target.moveTo(endX, endY);
  target.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 6),
    endY - headLength * Math.sin(angle - Math.PI / 6),
  );
  target.moveTo(endX, endY);
  target.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 6),
    endY - headLength * Math.sin(angle + Math.PI / 6),
  );
}

function drawShape(target, tool, startX, startY, endX, endY, color) {
  applyStrokeSettings(target, color);
  target.beginPath();

  if (tool === "line") {
    target.moveTo(startX, startY);
    target.lineTo(endX, endY);
    target.stroke();
    return;
  }

  if (tool === "arrow") {
    arrowPath(target, startX, startY, endX, endY);
    target.stroke();
    return;
  }

  const width = endX - startX;
  const height = endY - startY;

  if (tool === "rectangle") {
    if (state.fillShape) {
      target.fillRect(startX, startY, width, height);
    } else {
      target.strokeRect(startX, startY, width, height);
    }
    return;
  }

  if (tool === "rounded-rectangle") {
    roundedRectPath(target, startX, startY, width, height, Math.max(14, state.lineWidth));
  }

  if (tool === "circle") {
    const centerX = startX + width / 2;
    const centerY = startY + height / 2;
    const radiusX = Math.abs(width / 2);
    const radiusY = Math.abs(height / 2);
    target.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  }

  if (tool === "triangle") {
    const topX = startX + width / 2;
    target.moveTo(topX, startY);
    target.lineTo(startX, endY);
    target.lineTo(endX, endY);
    target.closePath();
  }

  if (state.fillShape) {
    target.fill();
  } else {
    target.stroke();
  }
}

function getPixel(imageData, x, y) {
  const index = (y * imageData.width + x) * 4;
  return [
    imageData.data[index],
    imageData.data[index + 1],
    imageData.data[index + 2],
    imageData.data[index + 3],
  ];
}

function colorsMatch(first, second) {
  return first[0] === second[0]
    && first[1] === second[1]
    && first[2] === second[2]
    && first[3] === second[3];
}

function hexToRgba(hex) {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    255,
  ];
}

function rgbaToHex(rgba) {
  return `#${rgba.slice(0, 3).map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function setPixel(imageData, x, y, rgba) {
  const index = (y * imageData.width + x) * 4;
  imageData.data[index] = rgba[0];
  imageData.data[index + 1] = rgba[1];
  imageData.data[index + 2] = rgba[2];
  imageData.data[index + 3] = rgba[3];
}

function floodFill(startX, startY, hexColor) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const targetColor = getPixel(imageData, startX, startY);
  const replacementColor = hexToRgba(hexColor);

  if (colorsMatch(targetColor, replacementColor)) {
    return;
  }

  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const currentColor = getPixel(imageData, x, y);

    if (!colorsMatch(currentColor, targetColor)) {
      continue;
    }

    setPixel(imageData, x, y, replacementColor);

    if (x > 0) {
      stack.push([x - 1, y]);
    }
    if (x < imageData.width - 1) {
      stack.push([x + 1, y]);
    }
    if (y > 0) {
      stack.push([x, y - 1]);
    }
    if (y < imageData.height - 1) {
      stack.push([x, y + 1]);
    }
  }

  context.putImageData(imageData, 0, 0);
}

function sampleColor(x, y) {
  const pixel = context.getImageData(x, y, 1, 1).data;
  const color = rgbaToHex([pixel[0], pixel[1], pixel[2], pixel[3]]);
  state[state.activeColorKey] = color;
  updateColorReadout();
  footerHint.textContent = `Picked ${color}`;
}

function handleSingleActionTool(x, y) {
  if (state.tool === "fill") {
    floodFill(Math.floor(x), Math.floor(y), getActiveColor());
    saveSnapshot();
  }

  if (state.tool === "eyedropper") {
    sampleColor(Math.floor(x), Math.floor(y));
  }
}

function startDrawing(event) {
  event.preventDefault();
  setActiveColorFromButton(event);

  const { x, y } = getPointerPosition(event);
  state.startX = x;
  state.startY = y;
  state.lastX = x;
  state.lastY = y;

  if (state.tool === "fill" || state.tool === "eyedropper") {
    handleSingleActionTool(x, y);
    updateStatus();
    return;
  }

  state.drawing = true;
  canvas.setPointerCapture(event.pointerId);

  const activeColor = getActiveColor();
  const strokeWidth = state.tool === "pencil" ? Math.max(1, state.lineWidth / 2) : state.lineWidth;

  if (state.tool === "pencil" || state.tool === "brush" || state.tool === "eraser") {
    context.beginPath();
    context.moveTo(x, y);
    applyStrokeSettings(context, activeColor, strokeWidth);
    context.globalCompositeOperation = state.tool === "eraser" ? "destination-out" : "source-over";
  }

  if (state.tool === "spray") {
    sprayAt(x, y, activeColor);
  }
}

function draw(event) {
  if (!state.drawing) {
    return;
  }

  const { x, y } = getPointerPosition(event);
  state.lastX = x;
  state.lastY = y;
  const activeColor = getActiveColor();

  if (state.tool === "pencil" || state.tool === "brush" || state.tool === "eraser") {
    drawBrushStroke(context, x, y);
    return;
  }

  if (state.tool === "spray") {
    sprayAt(x, y, activeColor);
    return;
  }

  if (shapeTools.has(state.tool)) {
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    drawShape(previewContext, state.tool, state.startX, state.startY, x, y, activeColor);
  }
}

function stopDrawing(event) {
  if (!state.drawing) {
    return;
  }

  state.drawing = false;

  if (event) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (shapeTools.has(state.tool)) {
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    drawShape(
      context,
      state.tool,
      state.startX,
      state.startY,
      state.lastX,
      state.lastY,
      getActiveColor(),
    );
  }

  context.closePath();
  context.globalCompositeOperation = "source-over";
  saveSnapshot();
}

function undo() {
  if (state.history.length <= 1) {
    return;
  }

  const current = state.history.pop();
  state.redoStack.push(current);
  restoreSnapshot(state.history[state.history.length - 1]);
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  updateActionButtons();
}

function redo() {
  if (state.redoStack.length === 0) {
    return;
  }

  const snapshot = state.redoStack.pop();
  state.history.push(snapshot);
  restoreSnapshot(snapshot);
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  updateActionButtons();
}

function clearCanvas() {
  fillBackground();
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  saveSnapshot();
  footerHint.textContent = "Canvas cleared";
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = "paint-web-app.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function swapColors() {
  const nextPrimary = state.secondaryColor;
  state.secondaryColor = state.primaryColor;
  state.primaryColor = nextPrimary;
  updateColorReadout();
}

function setLineWidth(size) {
  state.lineWidth = size;
  sizeSlider.value = String(size);
  sizeValue.textContent = `${size} px`;
  updateSizeChips();
  updateStatus();
}

function handleKeyboardShortcuts(event) {
  const key = event.key.toLowerCase();

  if (event.ctrlKey && key === "z") {
    event.preventDefault();
    undo();
    return;
  }

  if (event.ctrlKey && key === "y") {
    event.preventDefault();
    redo();
    return;
  }

  if (event.ctrlKey && key === "s") {
    event.preventDefault();
    downloadImage();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && key === "x") {
    event.preventDefault();
    swapColors();
  }
}

toolButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    state.primaryColor = swatch.dataset.color.toUpperCase();
    state.activeColorKey = "primaryColor";
    updateColorReadout();
    updateStatus();
  });
});

sizeChips.forEach((chip) => {
  chip.addEventListener("click", () => setLineWidth(Number(chip.dataset.size)));
});

primaryColorPicker.addEventListener("input", (event) => {
  state.primaryColor = event.target.value.toUpperCase();
  state.activeColorKey = "primaryColor";
  updateColorReadout();
  updateStatus();
});

secondaryColorPicker.addEventListener("input", (event) => {
  state.secondaryColor = event.target.value.toUpperCase();
  state.activeColorKey = "secondaryColor";
  updateColorReadout();
  updateStatus();
});

swapColorsButton.addEventListener("click", swapColors);

sizeSlider.addEventListener("input", (event) => {
  setLineWidth(Number(event.target.value));
});

fillShapeToggle.addEventListener("change", (event) => {
  state.fillShape = event.target.checked;
  updateStatus();
});

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
clearButton.addEventListener("click", clearCanvas);
downloadButton.addEventListener("click", downloadImage);

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

document.addEventListener("keydown", handleKeyboardShortcuts);

fillBackground();
saveSnapshot();
updateActionButtons();
updateColorReadout();
setLineWidth(state.lineWidth);
updateStatus();
