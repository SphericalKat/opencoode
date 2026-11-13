## Agent skills

### Issue tracker

Use GitHub Issues in `SphericalKat/opencoode`. Before tracker operations, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage roles. Before categorizing or changing triage state, read `docs/agents/triage-labels.md`.

### Domain docs

Use a single context. Before exploring domain concepts or proposing changes, read `docs/agents/domain.md`.

## UI design

Before building or changing UI, read `DESIGN.md`.

## Commits and pull requests

Use Conventional Commits for every agent-authored commit title. Prefer the same format for PR titles: `<type>(<scope>): <summary>`, with the scope optional.

- Use `fix` for bug fixes, `feat` for new features, and `perf` for performance improvements. Use `docs`, `test`, `refactor`, `build`, `ci`, or `chore` for the corresponding maintenance work.
- Choose a lowercase scope that names the affected component, such as `chat` or `markdown`. Write a concise imperative summary and keep the subject within 72 characters.
- Apply this format to implementer, review-fix, and integration commits. Include the rule when delegating implementation or merging to a subagent.
- Before each commit, verify that its title follows this format. Verify PR titles before publication and merge.
- Release Please derives release versions and changelog entries from Conventional Commits on `develop`.
- Merge reviewed feature PRs into `develop` with a merge commit, as described in `docs/releases.md`.
- Verify that each feature PR contains a Conventional Commit for its user-visible change before merge. A PR title alone does not replace this requirement.

Example: `fix(markdown): keep user messages inside their bubbles`.

### Screenshots in pull requests

If a PR changes what the app shows, include before and after screenshots in its description when possible.

- Capture the "before" screenshot from the base branch and the "after" screenshot from the PR branch.
- Use the same device, screen, and data for both screenshots.
- Attach each image with `gh pr create --attach '<file>#<alt text>'`, and reference it in the body as `![alt text](./<file>)`.

## Linting and formatting

Ultracite runs Oxlint and Oxfmt with the `core`, `react` and `react-native` presets. The config is in `oxlint.config.ts` and `oxfmt.config.ts`. CI runs `pnpm check` in the "Lint and format" job of `.github/workflows/ci.yml`. A PR must pass it.

- Run `pnpm fix` before each commit, then `pnpm check`. Fix every error that `check` reports in the files you changed.
- Do not turn off, downgrade or override rules in `oxlint.config.ts` to make `check` pass. Do not add `oxlint-disable` comments. Change the code instead. If a rule is wrong for this project, say so in the PR. Do not suppress the rule.
- Write new code in the formatter's style. Do not put JSX props, style objects or long expressions on one line and expect the formatter to fix them. Split large components and functions. Do not add to them.
- Run `pnpm typecheck` and `pnpm test` after `pnpm fix`, because some autofixes change behavior. Known unsafe autofixes in this codebase:
  - `[...x]` in place of `x.slice()` converts a `Uint8Array` to `number[]`.
  - `interface` in place of `type` removes the implicit index signature. React Navigation param lists and types cast from `Record<string, unknown>` must stay `type` aliases.
  - `.at(-1)` returns `T | undefined` where an index access returned `T`.
  - `toSorted()` and the other ES2023 copy methods (`toReversed`, `toSpliced`, `with`) are missing from Hermes. They throw `undefined is not a function` on Android and work in browsers and Node. `unicorn/no-array-sort` suggests `toSorted()`. Keep `.sort()` on a copy, and list the rule in the PR.
- After a lint change that touches runtime code, verify it on Android as described in "Verify on Android". Typecheck, unit tests and a browser load do not run Hermes.
- Keep lint-only changes in their own commits, such as `refactor(chat): ...` or `chore(lint): ...`. Do not mix them with behavior changes.

## Android development

Use the `android-cli` skill for native builds, device interaction, and screenshots. Read its `references/interact.md` before inspecting or interacting with a device. Check installed CLI flags with `--help`; they can differ from the skill's examples.

### Build and launch

- This is an Expo / React Native app. See `README.md` for dependency setup and `package.json` for development commands.
- `pnpm android` starts Metro; it does not compile a new native APK. For a native development build, use `pnpm exec expo run:android --device`.
- For a Gradle-only APK build, run `./gradlew :app:assembleDebug` from `android/`. Its output is `android/app/build/outputs/apk/debug/app-debug.apk` relative to the repository root.
- The Android CLI also supports `android build`; inspect `android build --help` for build-reference arguments. Deploy an existing APK with `android run --device <serial> --apks <apk-path> --activity dev.opencoode.mobile.MainActivity`.
- Use the `android-emulator` skill to start a private emulator for each task. Shut it down with the skill before the task ends.
- Select the target explicitly when multiple devices are connected. Use only the emulator that your task started.
- Debug builds need Metro. For a USB-connected device, reverse its selected Metro port with `adb -s <serial> reverse tcp:<port> tcp:<port>`.
- On an emulator, a debug build loads its bundle from `10.0.2.2:8081`, the host computer, so `adb reverse` has no effect. To use a different Metro port, set `debug_http_host` in `shared_prefs/dev.opencoode.mobile_preferences.xml` with `adb shell run-as dev.opencoode.mobile`, then restart the app.
- Rebuild the APK when `develop` adds a native module. An old APK with a newer bundle can fail in ways the source change did not cause.

### Verify on Android

This is a mobile app. Verify runtime changes on an Android emulator or device with the Android CLI. Do not use Playwright, a browser, or `expo export --platform web` as proof. React Native Web runs in a browser engine with different JavaScript APIs, and it does not exercise native modules.

1. Build or reuse a debug APK that matches the branch, install it with `android run`, and point it at Metro serving the branch.
2. Connect it to an isolated OpenCode server. `tests/live-server.ts` shows the environment variables that isolate the server's config and data. From an emulator, the server address is `http://10.0.2.2:<port>`.
3. Open every screen the change touches. Check `logcat` for `ReactNativeJS` errors after each step, and inspect a screenshot.
4. For a refactor, repeat the same steps with Metro serving `develop`. The native APK can stay the same. Report each difference between the two runs.

### Inspect and debug

- Inspect controls with `android layout --device <serial> --flat`; use `--full` when non-interactive elements are needed.
- Use current layout selectors for input: `android input --device <serial> tap 'desc=<label>'`. Run `android input text --help` for text entry; confirm the intended field is focused before typing.
- Capture with `android screen capture --device <serial> -o /tmp/<issue>-<screen>.png`, then visually inspect the image before continuing. Use `--annotate` when the layout cannot identify a visual element.
- Read runtime logs with `adb -s <serial> logcat -d -s ReactNativeJS AndroidRuntime`. An installed or launched APK is not proof that JavaScript rendered successfully.
- Confirm that the APK matches the source under investigation. Label screenshots from fixtures with their sample data and platform; separate them from captures of the full connected app.
- When other sessions share the checkout, keep fixtures, bundles, screenshots, and logs in an issue-specific directory under `/tmp`. Preserve other sessions' files and device work.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns
- Avoid import cycles; move shared code into a module both sides import

### Security

- Add `rel="noopener noreferrer"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `pnpm exec ultracite fix` before committing to ensure compliance.
