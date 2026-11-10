# Handoff: Milky Way far-field sprite (eon)

Date: 2026-11-10
Repo: https://github.com/ajdohaxhia/palebluedot.git
Branch: `main`, in sync with `origin/main` at `3f37194` when this file was written.
Project root: `/Users/ade/Documents/deepseek-harness/default-workspace/eon`

## 1. Current state

The far-field Milky Way sprite (`this.mwSprite` in `src/scenes/DeepScene.js`) uses the procedural barred texture again, the same texture as the disk mesh. The ESO photo experiment is reverted.

Recent history on `origin/main`:

- `3f37194` Revert unsuitable ESO panorama from Milky Way far-field sprite. Restores the procedural `map`, removes the photo loader and canvas, deletes `assets/textures/galaxies/milkyway-eso-6k.jpg` from HEAD, adds `.gitignore` entries, and removes the throwaway debugging scripts.
- `9103c6b` Use ESO Milky Way photo for the far-field galaxy sprite. This introduced the photo sprite.
- `0bd368c` Enlarge slide viewer and keep presentation mode after free atlas.

Validation reported for `3f37194`:

- Browser: the far-field sprite renders as a face-on barred galaxy. No requests for `milkyway-eso-6k.jpg`, no console errors.
- `node --check src/scenes/DeepScene.js` passed.
- `npm test` passed, 28 of 28. The pre-push hook ran the same suite.
- Production already serves the procedural sprite, so no deploy was needed.

## 2. Why the ESO photo was rejected

The ESO image is 6000x3000 (2:1). It is an all-sky panorama with a horizontal band, not a face-on galaxy. At the real far-field distances it showed as a faint dark band inside the radial fade.

The 7.2 MB file (7,585,150 bytes) is still in Git history at `9103c6b`. Removing it needs a history rewrite and a force push. That was not done.

## 3. Work left

### 3.1 Find a suitable Milky Way image (optional)

The procedural sprite works. A photo is only worth adding if it is a face-on or top-down Milky Way image. None is in the repo. Any new image needs a source and license note, like the other textures.

Note that `assets/textures/galaxies/milky-way-arch.jpg` is a ground-level panorama and is also unsuitable.

If this is pursued:

1. Pick a candidate and confirm its license.
2. Preview at reduced size with `sips -Z 2400 <file> --out /tmp/mw-preview.jpg`. Do not commit the preview. Files above 5 MB cannot be viewed directly through the image tool.
3. Wire it into the sprite with a fallback to the procedural texture. Draw the procedural texture first so the sprite is never empty if the photo fails to load. Use a cover fit for non-square images, because a contain fit squashes a 2:1 image into a thin strip.
4. Check it in the browser against the neighbouring galaxy sprites for crop, edge fade and brightness.
5. Run `npm test` and `node --check src/scenes/DeepScene.js`.

### 3.2 Remove the 7.2 MB object from history (optional, needs owner approval)

This needs a history rewrite and a force push, which affects everyone with the repo. Do not do it without the owner's explicit approval. If a photo is adopted again, downscale it to about 2048 px, which is enough for a 1280 px canvas.

### 3.3 Test gap

No test checks that a referenced texture file exists. Add one next to the existing slide-image test in `tests/cosmos.test.mjs`. The tests do not render the scene.

### 3.4 Disk mesh

The Milky Way disk mesh (`mwDisk`) is still procedural. Decide whether it should ever get a photo. It is not required.

### 3.5 Local files left on disk (ignored, not tracked)

These are ignored by `.gitignore` and were kept on purpose:

- `assets/textures/galaxies/hubble-udf-hr.jpg`
- `assets/textures/galaxies/messier51-4k.jpg`
- `assets/textures/galaxies/messier51-full.jpg`
- `presentazione.pdf`
- `screenshots/*` (QA captures)
- `.DS_Store`, `.npmcache/`, `dist/`, `node_modules/`

Check whether code references the `hubble` or `messier51` textures. A fresh clone will not have them. If code uses them, either commit them with a source note or remove the references.

## 4. Working in this repo

- Tests: `npm test` runs `node --test tests/astronomy.test.mjs tests/cosmos.test.mjs`. Expect 28 passing.
- Syntax check: `node --check src/scenes/DeepScene.js`.
- The pre-push hook (ECC) runs the test script and skips the missing `lint`, `typecheck` and `build` scripts.
- Git commands must be non-interactive. Use `git commit -m "..."`, never an editor.
- Stage files by name. Do not use `git add -A`, so screenshots, scripts and `.DS_Store` stay out of commits.
- `CLAUDE.md` points to agent skills under `.agent-skills/mattpocock/skills/`. Read the relevant `SKILL.md` before development tasks. Issues and specs are markdown under `.scratch/<feature>/`. The glossary is `GLOSSARY.md` and ADRs are in `docs/adr/`.
- Run git commands from the project root, not from `/Users/ade`.

## 5. Definition of done for remaining work

- If a new Milky Way image is adopted, it has been checked in a browser, looks right, and has a source and license note.
- The texture-existence test from 3.3 is added and `npm test` passes.
- Any new or changed files are committed or ignored on purpose.
