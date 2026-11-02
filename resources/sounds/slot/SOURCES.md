# Slot machine sounds

Synthesised for the launcher: FM and virtual-analog voices, filtered noise, delay and plate reverb, with no recordings or third-party samples, so nothing needs attribution. All six are in E major at 150 BPM, the beat the reels stop on (`SLOT_BEAT_MS` in `slotReelMotion.ts`), and are encoded as 48 kHz stereo Opus with a 160 kbps VBR target, with intensity-stereo phase inversion off so they fold down to mono cleanly. `reel-spin.ogg` starts with a 100 ms lead-in copied from the end of its bar, hidden in the Opus pre-skip, so the decoder warms up on the loop itself and the join does not click; a re-encode has to keep it.

| File | Sound | Where `slotSounds.ts` plays it |
|---|---|---|
| `reel-spin.ogg` | One seamless 1.6 s bar: a sixteenth-note glass FM arpeggio over a quiet E3+B3 hum | looped while the reels spin (`SPIN_LOOP_S`), quieter as each reel stops |
| `reel-stop.ogg` | A short glass FM pluck on E5 with a soft E4 body | once per reel, a root, major third and fifth apart (`REEL_STOP_RATE`) |
| `hold.ogg` | Two hollow FM notes, B5 then E6, 45 ms apart | holding a reel; letting it go plays it a fourth lower |
| `payout.ogg` | A thirty-second-note run E5–B6 opening into a wide E major chord with high sparkles, about 1.9 s | the claimed name |
| `ratchet.ogg` | A 35 ms glass blip on E5 | the lever's ticks, climbing the pentatonic scale from E5 to E6 (`RATCHET_RATE`) |
| `lever-thunk.ogg` | An electronic kick falling E4→E2, a glass E4+B4 chord and a noise sweep falling from about 4.5 kHz to 1 kHz into the spin bar | the lever reaching the bottom |
