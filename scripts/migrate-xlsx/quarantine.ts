// JSONL quarantine writer + structured stderr emitter.
// Each row processed may emit zero or more QuarantineRecords. Records survive
// dry-run rollback because writes go to stderr + a local JSONL file, not the DB.

import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import type { QuarantineRecord } from "./types";

const QUARANTINE_DIR = resolve(import.meta.dirname, "../../tmp");

export class QuarantineSink {
  private stream: WriteStream;
  private _count = 0;
  private _errorCount = 0;
  private _warnCount = 0;

  constructor(public readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: "a", encoding: "utf-8" });
  }

  write(record: QuarantineRecord): void {
    this._count++;
    if (record.severity === "error") this._errorCount++;
    else this._warnCount++;
    this.stream.write(JSON.stringify(record) + "\n");
    process.stderr.write(
      `[row ${record.rowNumber}] ${record.severity.toUpperCase()} ` +
        `col ${record.column} (${record.header}): ${record.reason}` +
        (record.rawValue ? ` — raw="${record.rawValue}"` : "") +
        "\n",
    );
  }

  writeMany(records: readonly QuarantineRecord[]): void {
    for (const r of records) this.write(r);
  }

  get count(): number {
    return this._count;
  }
  get errorCount(): number {
    return this._errorCount;
  }
  get warnCount(): number {
    return this._warnCount;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}

export function quarantinePath(timestamp = new Date()): string {
  const stamp = timestamp.toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return resolve(QUARANTINE_DIR, `quarantine-${stamp}.jsonl`);
}
