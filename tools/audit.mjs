#!/usr/bin/env node
/**
 * Auditoría local del sitio de Jaz Jaz Crochet.
 *
 * Abre Google Chrome/Chromium en modo headless mediante el protocolo DevTools
 * (sin dependencias npm), revisa el sitio servido localmente y guarda capturas:
 *
 *   - errores/excepciones de consola
 *   - desbordes horizontales en móvil, tableta y escritorio
 *   - imágenes rotas y recursos locales faltantes
 *   - enlaces internos que no apuntan a una sección existente
 *   - canales de contacto sin destino real visibles
 *   - accesibilidad con axe-core (se descarga una vez desde unpkg; opcional)
 *
 * Uso:
 *   python3 -m http.server 4173 &
 *   node tools/audit.mjs --url http://localhost:4173/ --out /tmp/jaz-audit
 *   node tools/audit.mjs --no-axe          # sin conexión a internet
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844, mobile: true, scale: 2 },
  { name: "tableta", width: 768, height: 1024, mobile: true, scale: 2 },
  { name: "escritorio", width: 1440, height: 900, mobile: false, scale: 1 },
];

const args = process.argv.slice(2);

function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const url = argValue("--url", "http://localhost:4173/");
const outDir = argValue("--out", path.join(os.tmpdir(), "jaz-jaz-audit"));
const useAxe = !args.includes("--no-axe");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
  if (!found) {
    throw new Error(
      "No se encontró Chrome/Chromium. Define CHROME_PATH con la ruta al ejecutable."
    );
  }
  return found;
}

async function fetchJson(port, route, method = "GET") {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method });
  return response.json();
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data || "")})`));
        } else {
          resolve(message.result);
        }
        return;
      }
      if (message.method && this.listeners.has(message.method)) {
        this.listeners.get(message.method).forEach((listener) => listener(message.params));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Tiempo de espera agotado en ${method}`));
        }
      }, 30000);
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, []);
    }
    this.listeners.get(method).push(listener);
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Error al evaluar JavaScript");
    }
    return result.result.value;
  }
}

async function launchChrome() {
  const chromePath = findChrome();
  const userDataDir = path.join(os.tmpdir(), `jaz-chrome-${process.pid}`);
  await rm(userDataDir, { recursive: true, force: true });

  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--mute-audio",
      `--user-data-dir=${userDataDir}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const portFile = path.join(userDataDir, "DevToolsActivePort");
  let port = null;

  for (let attempt = 0; attempt < 100 && !port; attempt += 1) {
    await sleep(100);
    if (existsSync(portFile)) {
      const contents = await readFile(portFile, "utf8");
      const [firstLine] = contents.trim().split("\n");
      if (firstLine) {
        port = Number(firstLine);
      }
    }
  }

  if (!port) {
    child.kill("SIGKILL");
    throw new Error("Chrome no expuso el puerto de depuración.");
  }

  return { child, port, userDataDir };
}

async function openPage(port) {
  const target = await fetchJson(port, "/json/new?about:blank", "PUT");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("No se pudo abrir CDP")), {
      once: true,
    });
  });
  return new Cdp(socket);
}

function collectConsole(cdp, sink) {
  cdp.on("Runtime.exceptionThrown", (params) => {
    sink.push(`excepción: ${params.exceptionDetails.text || "desconocida"}`);
  });
  cdp.on("Runtime.consoleAPICalled", (params) => {
    if (params.type === "error") {
      sink.push(
        `console.error: ${params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")}`
      );
    }
  });
  cdp.on("Log.entryAdded", (params) => {
    if (params.entry.level === "error") {
      sink.push(`log: ${params.entry.text}`);
    }
  });
}

const CHECKS = `(() => {
  const doc = document.documentElement;
  const hidden = (el) => Boolean(el.closest("[hidden]"));
  const anchors = [...document.querySelectorAll('a[href^="#"]')]
    .filter((a) => !hidden(a))
    .map((a) => {
      const href = a.getAttribute("href");
      return {
        href,
        text: (a.textContent || "").trim().slice(0, 40),
        valid: href.length > 1 ? Boolean(document.querySelector(href)) : false,
      };
    });
  return {
    title: document.title,
    lang: doc.lang,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    innerWidth: window.innerWidth,
    pageHeight: doc.scrollHeight,
    brokenImages: [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0 && Boolean(img.currentSrc || img.getAttribute("src")))
      .map((img) => img.currentSrc || img.getAttribute("src")),
    imagesWithoutAlt: [...document.images].filter((img) => !img.hasAttribute("alt")).length,
    lazyImages: [...document.images].filter((img) => img.loading === "lazy").length,
    pictureElements: document.querySelectorAll("picture").length,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    anchors,
    placeholderLinks: [...document.querySelectorAll('a[href="#"]')].filter((a) => !hidden(a)).length,
    visibleChannels: [...document.querySelectorAll("[data-channel]")]
      .filter((node) => !node.hidden && node.offsetParent !== null)
      .map((node) => ({
        channel: node.getAttribute("data-channel"),
        href: node.getAttribute("href"),
        text: (node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60),
      })),
    formFields: document.querySelectorAll("#pedido-form input, #pedido-form select, #pedido-form textarea").length,
    resultHidden: document.querySelector("[data-result]") ? document.querySelector("[data-result]").hidden : null,
    headingOutline: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName + " " + h.textContent.trim().slice(0, 60)),
  };
})()`;

async function runViewport(cdp, viewport, consoleErrors) {
  const { width, height, mobile, scale } = viewport;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });

  const loaded = new Promise((resolve) => {
    cdp.on("Page.loadEventFired", resolve);
    setTimeout(resolve, 15000);
  });

  await cdp.send("Page.navigate", { url });
  await loaded;
  await sleep(900);
  await cdp.evaluate("document.documentElement.style.scrollBehavior = 'auto'");
  await cdp.evaluate("window.scrollTo(0, 0)");
  await sleep(900);

  const data = await cdp.evaluate(CHECKS);

  const metrics = await cdp.send("Page.getLayoutMetrics");
  const content = metrics.cssContentSize;
  const full = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.min(content.width, width),
      height: Math.ceil(content.height),
      scale: 0.5,
    },
  });
  await writeFile(
    path.join(outDir, `${viewport.name}-completo.png`),
    Buffer.from(full.data, "base64")
  );

  const topShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(outDir, `${viewport.name}-inicio.png`),
    Buffer.from(topShot.data, "base64")
  );

  for (const section of ["catalogo", "nosotros", "galeria", "pedidos", "contacto"]) {
    await cdp.evaluate(`document.getElementById("${section}").scrollIntoView({block: "start"})`);
    await sleep(1100);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      path.join(outDir, `${viewport.name}-${section}.png`),
      Buffer.from(shot.data, "base64")
    );
  }

  return {
    viewport,
    consoleErrors: [...consoleErrors],
    overflow: data.scrollWidth > data.clientWidth,
    data,
  };
}

async function getAxeSource() {
  const cache = path.join(os.tmpdir(), "jaz-axe-core.js");
  if (existsSync(cache)) {
    return readFile(cache, "utf8");
  }
  const response = await fetch("https://unpkg.com/axe-core@4.10.2/axe.min.js");
  if (!response.ok) {
    throw new Error(`No se pudo descargar axe-core (${response.status})`);
  }
  const source = await response.text();
  await writeFile(cache, source);
  return source;
}

async function runAxe(cdp) {
  const source = await getAxeSource();
  await cdp.evaluate(`${source}\n//# sourceURL=axe.min.js`);
  const json = await cdp.evaluate(
    `axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }).then((results) => JSON.stringify({
      violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.map((n) => n.target.join(" ")).slice(0, 4) })),
      passes: results.passes.length,
      incomplete: results.incomplete.map((i) => i.id)
    }))`,
    true
  );
  return JSON.parse(json);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const { child, port, userDataDir } = await launchChrome();
  const report = { url, startedAt: new Date().toISOString(), viewports: [], axe: null, ok: true };

  try {
    const cdp = await openPage(port);
    const consoleErrors = [];
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    collectConsole(cdp, consoleErrors);

    for (const viewport of VIEWPORTS) {
      const result = await runViewport(cdp, viewport, consoleErrors);
      report.viewports.push(result);
    }

    if (useAxe) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      report.axe = await runAxe(cdp);
    }
  } catch (error) {
    report.ok = false;
    report.error = error.message;
  } finally {
    child.kill("SIGKILL");
    await rm(userDataDir, { recursive: true, force: true });
  }

  const problems = [];
  report.viewports.forEach((entry) => {
    if (entry.overflow) {
      problems.push(`${entry.viewport.name}: desborde horizontal`);
    }
    entry.consoleErrors.forEach((message) => problems.push(`${entry.viewport.name}: ${message}`));
    if (entry.data.brokenImages.length) {
      problems.push(`${entry.viewport.name}: imágenes rotas ${entry.data.brokenImages.join(", ")}`);
    }
    const brokenAnchors = entry.data.anchors.filter((anchor) => !anchor.valid);
    if (brokenAnchors.length) {
      problems.push(
        `${entry.viewport.name}: enlaces internos inválidos ${brokenAnchors
          .map((anchor) => anchor.href)
          .join(", ")}`
      );
    }
    if (entry.data.placeholderLinks > 0) {
      problems.push(
        `${entry.viewport.name}: ${entry.data.placeholderLinks} enlace(s) href="#" visible(s)`
      );
    }
    if (entry.data.imagesWithoutAlt > 0) {
      problems.push(`${entry.viewport.name}: ${entry.data.imagesWithoutAlt} imagen(es) sin alt`);
    }
    if (entry.data.h1.length !== 1) {
      problems.push(`${entry.viewport.name}: se esperaba un h1, hay ${entry.data.h1.length}`);
    }
  });

  if (report.axe) {
    report.axe.violations.forEach((violation) => {
      problems.push(`axe/${violation.impact}: ${violation.id} (${violation.nodes} nodo/s)`);
    });
  }
  if (report.error) {
    problems.push(report.error);
  }

  report.problems = problems;
  report.ok = problems.length === 0 && report.ok;

  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  console.log(`Auditoría de ${url}`);
  console.log(`Capturas y reporte en: ${outDir}`);
  report.viewports.forEach((entry) => {
    const { viewport, data } = entry;
    console.log(
      `- ${viewport.name} (${viewport.width}x${viewport.height}): scrollWidth ${data.scrollWidth}/${data.clientWidth}, alto ${data.pageHeight}px, imágenes lazy ${data.lazyImages}, canales visibles ${data.visibleChannels.length}`
    );
    console.log(`  canales: ${JSON.stringify(data.visibleChannels)}`);
  });
  if (report.axe) {
    console.log(
      `- axe-core: ${report.axe.violations.length} violaciones, ${report.axe.passes} reglas superadas`
    );
  }
  if (problems.length) {
    console.log("\nProblemas detectados:");
    problems.forEach((problem) => console.log(`  * ${problem}`));
  } else {
    console.log("\nSin problemas detectados por esta auditoría.");
  }

  process.exitCode = report.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



