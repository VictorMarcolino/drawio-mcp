import { spawn } from "child_process";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import pako from "pako";

const DEFAULT_BASE_URL = "https://app.diagrams.net/";

const DESKTOP_EXTENSIONS =
{
  xml: ".drawio",
  csv: ".csv",
  mermaid: ".mmd",
};

const DEFAULT_DESKTOP_PATHS =
{
  win32:
  [
    "C:\\Program Files\\draw.io\\draw.io.exe",
  ],
  darwin:
  [
    "/Applications/draw.io.app/Contents/MacOS/draw.io",
  ],
};

// Longest URL the Windows shell opens reliably from a .url file:
// the InternetShortcut handler fails with Win32 error 122 ("The data
// area passed to a system call is too small") beyond
// INTERNET_MAX_URL_LENGTH (2083), so stay under it with some headroom.
const WIN_URL_FILE_MAX_LENGTH = 2000;

/**
 * Compresses data using pako deflateRaw and encodes as base64.
 * This matches the compression used by draw.io tools.
 */
export function compressData(data)
{
  if (!data || data.length === 0)
  {
    return data;
  }
  const encoded = encodeURIComponent(data);
  const compressed = pako.deflateRaw(encoded);
  return Buffer.from(compressed).toString("base64");
}

/**
 * Generates a draw.io URL with the #create hash parameter.
 */
export function generateDrawioUrl(data, type, options = {})
{
  const {
    lightbox = false,
    border = 10,
    dark = false,
    edit = "_blank",
    baseUrl = DEFAULT_BASE_URL,
  } = options;

  const compressedData = compressData(data);

  const createObj = {
    type: type,
    compressed: true,
    data: compressedData,
  };

  const params = new URLSearchParams();

  if (lightbox)
  {
    params.set("lightbox", "1");
    params.set("edit", "_blank");
    params.set("border", "10");
  }
  else
  {
    params.set("grid", "0");
    params.set("pv", "0");
  }

  if (dark === true)
  {
    params.set("dark", "1");
  }

  params.set("border", border.toString());
  params.set("edit", edit);

  const createHash = "#create=" + encodeURIComponent(JSON.stringify(createObj));
  const paramsStr = params.toString();

  return baseUrl + (paramsStr ? "?" + paramsStr : "") + createHash;
}

/**
 * Desktop needs a real .drawio file. Bare mxGraphModel XML is wrapped.
 */
export function wrapXmlAsMxfile(content, now = new Date())
{
  if (/^\s*<mxfile[\s>]/i.test(content))
  {
    return content;
  }

  return (
    "<mxfile host=\"Electron\" modified=\"" + now.toISOString() +
    "\" agent=\"drawio-mcp\" version=\"24.0.0\">\n" +
    "<diagram name=\"Page-1\" id=\"mcp-page-1\">\n" +
    content.trim() +
    "\n</diagram>\n</mxfile>\n"
  );
}

export function resolveOpenMode(env = process.env)
{
  const raw = (env.DRAWIO_OPEN || "desktop").trim().toLowerCase();

  if (raw === "desktop")
  {
    return "desktop";
  }

  if (raw === "browser")
  {
    return "browser";
  }

  throw new Error(
    "Unknown DRAWIO_OPEN=\"" + env.DRAWIO_OPEN +
    "\". Use desktop or browser."
  );
}

export function resolveDrawioCommand(env = process.env, platform = process.platform)
{
  if (env.DRAWIO_CMD)
  {
    return env.DRAWIO_CMD;
  }

  const candidates = DEFAULT_DESKTOP_PATHS[platform] || [];

  for (let i = 0; i < candidates.length; i++)
  {
    if (existsSync(candidates[i]))
    {
      return candidates[i];
    }
  }

  return "drawio";
}

export function planOpen(options)
{
  const {
    content,
    type,
    lightbox = false,
    dark = false,
    env = process.env,
    tmpDir = tmpdir(),
    now = Date.now(),
    platform = process.platform,
    baseUrl = env.DRAWIO_BASE_URL || DEFAULT_BASE_URL,
  } = options;

  const mode = resolveOpenMode(env);

  if (mode === "browser")
  {
    return {
      mode: "browser",
      url: generateDrawioUrl(content, type, { lightbox, dark, baseUrl }),
    };
  }

  const extension = DESKTOP_EXTENSIONS[type];

  if (!extension)
  {
    throw new Error("Unknown diagram type \"" + type + "\".");
  }

  const path = join(tmpDir, "drawio-mcp-" + now + extension);
  const body = type === "xml" ? wrapXmlAsMxfile(content) : content;
  const command = resolveDrawioCommand(env, platform);

  return {
    mode: "desktop",
    path,
    body,
    command,
    args: [path],
  };
}

function buildRedirectHtml(url)
{
  // The #create= payload is percent-encoded, but DRAWIO_BASE_URL comes
  // from the environment, so escape anything that could break out of
  // the string literal or close the script element.
  const escaped = url
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/</g, "\\u003C");

  return "<!DOCTYPE html>\n" +
    "<html>\n" +
    "<head>\n" +
    "<meta charset=\"utf-8\">\n" +
    "<title>draw.io</title>\n" +
    "</head>\n" +
    "<body>\n" +
    "Opening draw.io...\n" +
    "<script>\n" +
    "window.location.replace(\"" + escaped + "\");\n" +
    "</script>\n" +
    "</body>\n" +
    "</html>\n";
}

function spawnDesktop(command, args, spawnFn)
{
  const child = spawnFn(command, args, {
    shell: false,
    stdio: "ignore",
    detached: true,
  });

  child.on("error", function(error)
  {
    console.error("Failed to open draw.io desktop: " + error.message);
  });

  child.unref();
  return child;
}

function openBrowser(url, spawnFn, platform, writeFile, tmp, now)
{
  let child;
  let tmpFile;

  if (platform === "win32")
  {
    // cmd.exe's "start" command treats & as a command separator and
    // drops everything after # in URLs, so the #create=... fragment
    // (which carries the entire diagram payload) is silently lost.
    // Writing a temporary .url file preserves the full URL intact, but
    // only up to the shell's InternetShortcut length limit — beyond it
    // the diagram is opened through a temporary HTML page instead,
    // which redirects from JavaScript (issue #54).
    if (url.length <= WIN_URL_FILE_MAX_LENGTH)
    {
      tmpFile = join(tmp, "drawio-mcp-" + now + ".url");
      writeFile(tmpFile, "[InternetShortcut]\r\nURL=" + url + "\r\n");
    }
    else
    {
      tmpFile = join(tmp, "drawio-mcp-" + now + ".html");
      writeFile(tmpFile, buildRedirectHtml(url));
    }

    child = spawnFn("cmd", ["/c", "start", "", tmpFile], {
      shell: false,
      stdio: "ignore",
    });

    setTimeout(function()
    {
      try { unlinkSync(tmpFile); } catch (e) { /* ignore */ }
    }, 10000);
  }
  else if (platform === "darwin")
  {
    child = spawnFn("open", [url], { shell: false, stdio: "ignore" });
  }
  else
  {
    child = spawnFn("xdg-open", [url], { shell: false, stdio: "ignore" });
  }

  child.on("error", function(error)
  {
    console.error("Failed to open browser: " + error.message);
  });

  child.unref();
  return child;
}

/**
 * Writes a desktop file (or a browser URL) and starts the editor.
 */
export function openDiagram(options)
{
  const {
    spawn: spawnFn = spawn,
    writeFile = writeFileSync,
    tmpDir = tmpdir(),
    now = Date.now(),
    platform = process.platform,
  } = options;

  const plan = planOpen({ ...options, tmpDir, now, platform });

  if (plan.mode === "desktop")
  {
    writeFile(plan.path, plan.body, "utf8");
    spawnDesktop(plan.command, plan.args, spawnFn);

    return {
      mode: "desktop",
      path: plan.path,
      message:
        "draw.io desktop:\n" + plan.path +
        "\n\nThe diagram has been opened in the local draw.io app.",
    };
  }

  openBrowser(plan.url, spawnFn, platform, writeFile, tmpDir, now);

  return {
    mode: "browser",
    url: plan.url,
    message:
      "Draw.io Editor URL:\n" + plan.url +
      "\n\nThe diagram has been opened in your default browser.",
  };
}
