# Themes and code colors

OpenCoode includes the GUI themes from [OpenCode](https://github.com/anomalyco/opencode/tree/33aefad13c54cd0276e46eb862f67365bce8c770/packages/ui/src/theme/themes), at revision `33aefad13c54cd0276e46eb862f67365bce8c770`. The app maps the resolved light and dark theme colors to its interface. The upstream MIT license appears in [upstream-opencode-license.txt](upstream-opencode-license.txt).

The code renderer uses Prism for explicitly labeled blocks in these languages:

- JavaScript
- TypeScript
- JSX
- TSX
- JSON
- Bash
- Python
- Java
- Kotlin
- C
- C++
- C#
- Go
- Rust
- SQL
- YAML
- CSS
- HTML
- XML

The renderer also accepts common aliases for these languages. Unknown and absent labels use plain text. The renderer excludes these block types from syntax colors:

- Markdown
- Plain text
- Commit messages

## Verification

The Android fixture captures use production components with sample model data. They do not show a connected server.
The app frame captures show the actual app before a server connection.
The native shell includes the Material 3 module from a fresh debug build.
The fixture uses an embedded JavaScript bundle to avoid the local Metro transport issue.

The emulator used 420 dpi. The variant options retained 48 dp touch targets with gaps near 4 dp.
The large-text capture uses a 1.5 font scale and a 1080 × 1600 viewport.
The fixture navigation controls use 8 dp gaps and wrap when space is limited.
The actual app retained frame colors `#080808` in dark mode and `#fafafa` in light mode.
The Material You background matched Android's system palette value, `#1a1b20`.

| Capture | Evidence |
| --- | --- |
| [Default light app frame](screenshots/issue-42/app-frame-light.png) | Actual app with its original light frame color |
| [Default dark app frame](screenshots/issue-42/app-frame-dark.png) | Actual app with its original dark frame color |
| [Original variant sheet](screenshots/issue-42/variant-sheet.png) | Earlier baseline with 12 dp gaps |
| [Revised variant sheet](screenshots/issue-42/variant-after.png) | Selected option and reduced gaps |
| [Large text](screenshots/issue-42/variant-large-short.png) | Selected option on a shorter screen |
| [Palette selector](screenshots/issue-42/palette-picker.png) | Existing palette, Material You, and upstream presets |
| [Material You](screenshots/issue-42/palette-material-you-dark.png) | Native wallpaper palette with dark appearance |
| [Dracula](screenshots/issue-42/palette-dracula-dark.png) | Upstream GUI preset with dark appearance |
| [Light code and diff](screenshots/issue-42/code-diff-light.png) | Visible syntax and diff colors |
| [Dark code and diff](screenshots/issue-42/code-diff-dark.png) | Visible syntax and diff colors |
| [Dracula code and diff](screenshots/issue-42/code-diff-dracula.png) | Syntax and diff colors from the upstream preset |

The browser checks cover code text, copy output, selection, and visible syntax colors.
They also cover diff text and visible addition and deletion colors.
The web export and typecheck passed.
The existing unit suite retained its baseline result: 31 passes and four unrelated failures.
I did not verify native iOS behavior on this Linux host.
