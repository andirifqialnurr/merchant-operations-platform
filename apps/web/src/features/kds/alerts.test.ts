import assert from "node:assert/strict";
import test from "node:test";

import { parseSoundSettings, VOLUME_LEVELS } from "./alerts";

test("sound settings fall back to on and loud when nothing usable is stored", () => {
  for (const stored of ["", "null", "not json", "[]", '{"muted":"yes","volume":"max"}']) {
    assert.deepEqual(parseSoundSettings(stored), { muted: false, volume: "high" });
  }
  assert.deepEqual(parseSoundSettings('{"muted":true,"volume":"low"}'), {
    muted: true,
    volume: "low",
  });
  assert.ok(VOLUME_LEVELS.low < VOLUME_LEVELS.medium && VOLUME_LEVELS.medium < VOLUME_LEVELS.high);
});
