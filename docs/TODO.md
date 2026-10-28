# Project to-do

Open work for the framework. Newest items at the bottom of each section. Mark an item done with
`[x]` and the date; delete done items once the knowledge they produced is in `kb/` or `docs/`.

## Setup
- [ ] *(example — replace)* Run the `bootstrap` workflow (`docs/workflows/bootstrap.md`) to replace
      the Example Notes worked examples with your app.

## Coverage
- [ ] *(example — replace)* Ask dev for `note_item_<n>` ids on the notes list (see testability register).

## Maestro 2.12 adoption (optional)
- [ ] Dark-mode coverage with `setDarkMode` / `assertDarkMode` (2.9) on the main screens.
- [ ] Visual regression with `assertScreenshot` on stable screens (pin the device — pixel compare is
      device-specific).
- [ ] Use Maestro's per-step screenshots + failure hierarchy (`--test-output-dir`, 2.7+) as failure evidence
      instead of manual captures (also avoids the spaces-in-path `takeScreenshot` bug).
