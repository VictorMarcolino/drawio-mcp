import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  planOpen,
  openDiagram,
  wrapXmlAsMxfile,
} from "../src/open-diagram.js";

const GRAPH =
  "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel>";
const MXFILE =
  "<mxfile host=\"Electron\"><diagram name=\"Page-1\" id=\"p1\">" + GRAPH + "</diagram></mxfile>";

function aPlan(overrides)
{
  return planOpen({
    content: GRAPH,
    type: "xml",
    tmpDir: "/tmp/drawio-plan",
    now: 99,
    env: {},
    ...overrides,
  });
}

function fakeChild()
{
  return {
    on: function() {},
    unref: function() {},
  };
}

test("desktop is the default: XML becomes a .drawio file for the local app", function()
{
  const plan = aPlan({});

  assert.equal(plan.mode, "desktop");
  assert.equal(plan.path, "/tmp/drawio-plan/drawio-mcp-99.drawio");
  assert.equal(plan.command, "drawio");
  assert.deepEqual(plan.args, [plan.path]);
  assert.match(plan.body, /<mxfile[\s>]/);
  assert.match(plan.body, /<mxGraphModel>/);
});

test("a bare mxGraphModel is wrapped so desktop can open it as a file", function()
{
  const wrapped = wrapXmlAsMxfile(GRAPH);

  assert.match(wrapped, /^<mxfile[\s>]/);
  assert.ok(wrapped.includes(GRAPH));
});

test("an mxfile is written unchanged", function()
{
  assert.equal(wrapXmlAsMxfile(MXFILE), MXFILE);
});

test("Mermaid is saved as .mmd so desktop opens it as an editable diagram", function()
{
  const mermaid = "flowchart TD\n  start --> finish";
  const plan = aPlan({ type: "mermaid", content: mermaid });

  assert.equal(plan.mode, "desktop");
  assert.equal(plan.path, "/tmp/drawio-plan/drawio-mcp-99.mmd");
  assert.equal(plan.body, mermaid);
});

test("CSV is saved as .csv so desktop can import it", function()
{
  const csv = "name,manager\nAda,\nGrace,Ada";
  const plan = aPlan({ type: "csv", content: csv });

  assert.equal(plan.path, "/tmp/drawio-plan/drawio-mcp-99.csv");
  assert.equal(plan.body, csv);
});

test("DRAWIO_CMD is the desktop binary; xdg-open is not used", function()
{
  const plan = aPlan({ env: { DRAWIO_CMD: "/opt/draw.io/drawio" } });

  assert.equal(plan.command, "/opt/draw.io/drawio");
  assert.ok(!plan.args.includes("xdg-open"));
});

test("DRAWIO_OPEN=browser still builds an app.diagrams.net create URL", function()
{
  const plan = aPlan({ env: { DRAWIO_OPEN: "browser" } });

  assert.equal(plan.mode, "browser");
  assert.match(plan.url, /^https:\/\/app\.diagrams\.net\//);
  assert.match(plan.url, /#create=/);
});

test("an unknown DRAWIO_OPEN is rejected instead of falling back to a browser", function()
{
  assert.throws(
    function()
    {
      aPlan({ env: { DRAWIO_OPEN: "xdg-open-hack" } });
    },
    /DRAWIO_OPEN/
  );
});

test("desktop open writes the file then starts the desktop app, not a browser", function()
{
  const dir = mkdtempSync(join(tmpdir(), "drawio-open-"));
  const spawns = [];

  const result = openDiagram({
    content: GRAPH,
    type: "xml",
    env: { DRAWIO_CMD: "/opt/draw.io/drawio" },
    tmpDir: dir,
    now: 7,
    spawn: function(command, args)
    {
      spawns.push({ command, args });
      return fakeChild();
    },
  });

  assert.equal(result.mode, "desktop");
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].command, "/opt/draw.io/drawio");
  assert.equal(spawns[0].args[0], result.path);
  assert.ok(!/xdg-open|https:\/\//.test(spawns[0].command + spawns[0].args.join(" ")));

  const written = readFileSync(result.path, "utf8");
  assert.match(written, /<mxfile[\s>]/);
  assert.match(result.message, /desktop/i);
  assert.ok(!/default browser/i.test(result.message));
});
