import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const imgDir = path.join(rootDir, "img");
const stateFilePath = path.join(rootDir, "selection-state.json");
const port = 3000;
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

function sanitizeFolderName(folderName) {
  const safePath = path.resolve(imgDir, folderName);
  const resolvedImgDir = path.resolve(imgDir);
  if (!safePath.startsWith(resolvedImgDir + path.sep) && safePath !== resolvedImgDir) {
    throw new Error("非法文件夹路径");
  }
  return safePath;
}

async function ensureWorkspace() {
  await mkdir(imgDir, { recursive: true });
}

async function listFolders() {
  await ensureWorkspace();
  const entries = await readdir(imgDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" }));
}

async function listImages(folderName) {
  const folderPath = sanitizeFolderName(folderName);
  const entries = await readdir(folderPath, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const extension = path.extname(entry.name).toLowerCase();
      if (!imageExtensions.has(extension)) return false;
      return entry.name !== `${folderName}+合并.jpg`;
    })
    .map((entry) => ({
      name: entry.name,
      url: `/files/${encodeURIComponent(folderName)}/${encodeURIComponent(entry.name)}`
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" }));
}

async function saveCollage(folderName, imageData) {
  const folderPath = sanitizeFolderName(folderName);
  const fileName = `${folderName}+合并.jpg`;
  const outputPath = path.join(folderPath, fileName);
  const base64 = String(imageData).replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  await writeFile(outputPath, buffer);
  return fileName;
}

async function readSelectionState() {
  try {
    const content = await readFile(stateFilePath, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeSelectionState(data) {
  await writeFile(stateFilePath, JSON.stringify(data, null, 2), "utf8");
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/") {
    const html = await readFile(path.join(rootDir, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (request.method === "GET" && url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/folders") {
    const folders = await listFolders();
    sendJson(response, 200, folders);
    return;
  }

  if (request.method === "GET" && /^\/api\/folders\/.+\/images$/.test(url.pathname)) {
    const parts = url.pathname.split("/");
    const folderName = decodeURIComponent(parts[3]);
    const images = await listImages(folderName);
    sendJson(response, 200, images);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/selection-state") {
    const state = await readSelectionState();
    sendJson(response, 200, state);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/selection-state") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const currentState = await readSelectionState();
        currentState[payload.folderName] = {
          slotIndices: Array.isArray(payload.slotIndices) ? payload.slotIndices : [],
          page: Number.isInteger(payload.page) ? payload.page : 0,
          fitMode: payload.fitMode === "cover" ? "cover" : "contain",
          savedAt: new Date().toISOString()
        };
        await writeSelectionState(currentState);
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendJson(response, 400, { error: error.message || "保存选择失败" });
      }
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/save-collage") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const fileName = await saveCollage(payload.folderName, payload.imageData);
        sendJson(response, 200, { ok: true, fileName });
      } catch (error) {
        sendJson(response, 400, { error: error.message || "保存失败" });
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/files/")) {
    const relativePath = url.pathname.replace("/files/", "");
    const filePath = path.resolve(imgDir, ...relativePath.split("/").map(decodeURIComponent));
    const resolvedImgDir = path.resolve(imgDir);

    if (!filePath.startsWith(resolvedImgDir + path.sep)) {
      sendText(response, 403, "Forbidden");
      return;
    }

    response.writeHead(200, { "Content-Type": getMimeType(filePath) });
    createReadStream(filePath).on("error", () => {
      sendText(response, 404, "Not found");
    }).pipe(response);
    return;
  }

  sendText(response, 404, "Not found");
}

await ensureWorkspace();

createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, { error: error.message || "服务器错误" });
  });
}).listen(port, () => {
  console.log(`九宫格选图工具已启动: http://localhost:${port}`);
});
