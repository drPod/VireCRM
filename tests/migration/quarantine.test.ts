// Unit tests for quarantine.ts — JSONL writer + stderr emitter.
// Pure FS/stderr, no Worker bindings → skip `cloudflare:test`.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QuarantineSink, quarantinePath } from "../../scripts/migrate-xlsx/quarantine";
import type { QuarantineRecord } from "../../scripts/migrate-xlsx/types";

// Per-test temp dir → isolated JSONL files, no cross-test bleed.
let tmpDir: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "quarantine-test-"));
  // Capture stderr; return true to satisfy WriteStream.write signature.
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeRecord(overrides: Partial<QuarantineRecord> = {}): QuarantineRecord {
  return {
    rowNumber: 42,
    column: "E",
    header: "Meter Number",
    rawValue: "1.04437e+16",
    reason: "precision-lossed scientific notation",
    severity: "error",
    ...overrides,
  };
}

function readLines(path: string): string[] {
  const raw = readFileSync(path, "utf-8");
  return raw.length === 0 ? [] : raw.replace(/\n$/, "").split("\n");
}

describe("quarantinePath()", () => {
  test("ISO-8601-stamped path under QUARANTINE_DIR (../../tmp from quarantine.ts)", () => {
    const ts = new Date("2026-05-24T13:45:09.123Z");
    const p = quarantinePath(ts);
    // Format: YYYY-MM-DD-HH-MM-SS (slice(0,19) then replace T+: with -)
    expect(p).toMatch(/quarantine-2026-05-24-13-45-09\.jsonl$/);
    // QUARANTINE_DIR resolves to <repo>/tmp from scripts/migrate-xlsx/quarantine.ts.
    expect(p).toBe(resolve(p)); // absolute
    expect(p.endsWith(join("tmp", "quarantine-2026-05-24-13-45-09.jsonl"))).toBe(true);
  });

  test("default arg uses now() — stamp matches recent ISO-8601 shape", () => {
    const before = Date.now();
    const p = quarantinePath();
    const after = Date.now();
    const match = p.match(/quarantine-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.jsonl$/);
    expect(match).not.toBeNull();
    // Reconstruct ISO from the stamp: YYYY-MM-DD-HH-MM-SS → YYYY-MM-DDTHH:MM:SSZ.
    const stamp = match![1];
    const iso = `${stamp.slice(0, 10)}T${stamp.slice(11, 13)}:${stamp.slice(14, 16)}:${stamp.slice(17, 19)}Z`;
    const parsed = Date.parse(iso);
    // Allow 2s window — second-precision slice + clock jitter.
    expect(parsed).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000 - 1000);
    expect(parsed).toBeLessThanOrEqual(after + 1000);
  });
});

describe("QuarantineSink — constructor", () => {
  test("creates parent dir recursively + file after first flush", async () => {
    const parent = join(tmpDir, "sub", "deep");
    const path = join(parent, "quarantine.jsonl");
    const sink = new QuarantineSink(path);
    // mkdirSync(recursive) runs in ctor → parent dir exists immediately.
    expect(existsSync(parent)).toBe(true);
    // createWriteStream opens the file lazily; close() flushes + creates it.
    await sink.close();
    expect(existsSync(path)).toBe(true);
  });

  test("exposes path as public readonly", async () => {
    const path = join(tmpDir, "out.jsonl");
    const sink = new QuarantineSink(path);
    expect(sink.path).toBe(path);
    await sink.close();
  });
});

describe("QuarantineSink — write()", () => {
  test("appends JSON line followed by newline", async () => {
    const path = join(tmpDir, "one.jsonl");
    const sink = new QuarantineSink(path);
    const rec = makeRecord();
    sink.write(rec);
    await sink.close();

    const lines = readLines(path);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual(rec);
    // Trailing newline preserved.
    expect(readFileSync(path, "utf-8").endsWith("\n")).toBe(true);
  });

  test("emits structured line to stderr alongside FS write", async () => {
    const path = join(tmpDir, "stderr.jsonl");
    const sink = new QuarantineSink(path);
    sink.write(
      makeRecord({
        rowNumber: 7,
        column: "F",
        header: "Supply Type",
        rawValue: "Solar",
        reason: "unsupported supply type",
        severity: "warn",
      }),
    );
    await sink.close();

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const emitted = stderrSpy.mock.calls[0][0] as string;
    expect(emitted).toBe(
      `[row 7] WARN col F (Supply Type): unsupported supply type — raw="Solar"\n`,
    );
  });

  test("empty rawValue omits the raw=... segment from stderr", async () => {
    const path = join(tmpDir, "noraw.jsonl");
    const sink = new QuarantineSink(path);
    sink.write(
      makeRecord({
        rowNumber: 3,
        column: "B",
        header: "Sale Id",
        rawValue: "",
        reason: "missing required field",
        severity: "error",
      }),
    );
    await sink.close();

    const emitted = stderrSpy.mock.calls[0][0] as string;
    expect(emitted).toBe(
      `[row 3] ERROR col B (Sale Id): missing required field\n`,
    );
    expect(emitted).not.toContain("raw=");
  });
});

describe("QuarantineSink — writeMany()", () => {
  test("writes each record as its own JSONL line", async () => {
    const path = join(tmpDir, "many.jsonl");
    const sink = new QuarantineSink(path);
    const recs: QuarantineRecord[] = [
      makeRecord({ rowNumber: 1, severity: "warn" }),
      makeRecord({ rowNumber: 2, severity: "error" }),
      makeRecord({ rowNumber: 3, severity: "error" }),
    ];
    sink.writeMany(recs);
    await sink.close();

    const lines = readLines(path);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => JSON.parse(l))).toEqual(recs);
    expect(stderrSpy).toHaveBeenCalledTimes(3);
  });

  test("empty array is a no-op", async () => {
    const path = join(tmpDir, "empty.jsonl");
    const sink = new QuarantineSink(path);
    sink.writeMany([]);
    await sink.close();

    expect(readFileSync(path, "utf-8")).toBe("");
    expect(sink.count).toBe(0);
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});

describe("QuarantineSink — count + errorCount getters", () => {
  test("count tracks all writes; errorCount tracks only severity=error", async () => {
    const path = join(tmpDir, "counts.jsonl");
    const sink = new QuarantineSink(path);

    expect(sink.count).toBe(0);
    expect(sink.errorCount).toBe(0);

    sink.write(makeRecord({ severity: "warn" }));
    expect(sink.count).toBe(1);
    expect(sink.errorCount).toBe(0);

    sink.write(makeRecord({ severity: "error" }));
    expect(sink.count).toBe(2);
    expect(sink.errorCount).toBe(1);

    sink.writeMany([
      makeRecord({ severity: "error" }),
      makeRecord({ severity: "warn" }),
      makeRecord({ severity: "error" }),
    ]);
    expect(sink.count).toBe(5);
    expect(sink.errorCount).toBe(3);

    await sink.close();
  });
});

describe("QuarantineSink — close()", () => {
  test("flushes buffered writes to disk", async () => {
    const path = join(tmpDir, "flush.jsonl");
    const sink = new QuarantineSink(path);
    // Write many records to exercise stream buffering.
    for (let i = 0; i < 100; i++) {
      sink.write(makeRecord({ rowNumber: i }));
    }
    await sink.close();

    const lines = readLines(path);
    expect(lines).toHaveLength(100);
    // First + last sanity-check.
    expect(JSON.parse(lines[0]).rowNumber).toBe(0);
    expect(JSON.parse(lines[99]).rowNumber).toBe(99);
  });

  test("resolves a Promise — awaitable", async () => {
    const path = join(tmpDir, "await.jsonl");
    const sink = new QuarantineSink(path);
    const result = sink.close();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  test("write after close — counters advance, stream write silently discarded", async () => {
    // QuarantineSink has no guard for post-close writes. Bun's WriteStream
    // (and Node's, with `autoDestroy` defaults) accept .write() after .end()
    // without throwing — the data is dropped. _count++ runs unconditionally
    // before stream.write(), so the counter still moves. Document current
    // behaviour; if a guard is added later, update this test.
    const path = join(tmpDir, "post-close.jsonl");
    const sink = new QuarantineSink(path);
    await sink.close();
    const before = sink.count;
    expect(() => sink.write(makeRecord({ severity: "error" }))).not.toThrow();
    expect(sink.count).toBe(before + 1);
    expect(sink.errorCount).toBe(1);
    // FS contents unchanged: post-close write is dropped.
    expect(readFileSync(path, "utf-8")).toBe("");
  });
});

