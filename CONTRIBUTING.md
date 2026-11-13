# Contribute to Opencoode

Opencoode accepts bug reports, feature requests, and pull requests. This guide describes the checks that a pull request must pass.

## Report a problem

1. Search the [open issues](https://github.com/SphericalKat/opencoode/issues) for the same problem.
2. Open a new issue if none exists.
3. Include the app version, the platform, and the OpenCode or Pi version.
4. Describe the steps, the expected result, and the actual result.
5. Attach screenshots or `logcat` output if they show the problem.

Remove server addresses, pairing links, and passwords from logs and screenshots before you post them.

## Set up the project

Follow [Develop](README.md#develop) in the README. The [glossary](GLOSSARY.md) defines the domain terms that the code uses.

## Change the code

1. Create a branch from `develop`.
2. Make the change.
3. Run the autofixes.

   ```sh
   pnpm fix
   ```

4. Run the checks.

   ```sh
   pnpm check
   pnpm typecheck
   pnpm test
   ```

5. Verify each runtime change on an Android emulator or device.
6. Open a pull request against `develop`.

CI runs `pnpm check`, `pnpm typecheck`, and `pnpm test` on each pull request. A pull request must pass all three.

### Lint rules

Ultracite runs Oxlint and Oxfmt. The configuration is in `oxlint.config.ts` and `oxfmt.config.ts`.

- Fix the code if a rule reports an error. Do not turn off a rule or add an `oxlint-disable` comment.
- If a rule is wrong for this project, explain the reason in the pull request.
- Keep lint-only changes in separate commits.

Some autofixes change runtime behavior. For example, `toSorted()` and the other ES2023 copy methods are missing from Hermes on Android. Use `.sort()` on a copy instead. [AGENTS.md](AGENTS.md#linting-and-formatting) lists the other unsafe autofixes.

### Verify on Android

Typecheck, unit tests, and a browser preview do not run Hermes or the native modules. Verify a runtime change in a debug build on an emulator or device.

1. Build the debug APK with `pnpm exec expo run:android --device`.
2. Connect the app to an isolated OpenCode server. `tests/live-server.ts` shows the environment variables that isolate its configuration and data.
3. Open each screen that the change affects.
4. Check `adb logcat -s ReactNativeJS` for errors.

Attach screenshots to the pull request for a visible change.

## Write commits

Release Please reads the commit titles on `develop` to create versions and changelog entries. Each commit title must use the [Conventional Commits](https://www.conventionalcommits.org/) format.

```text
<type>(<scope>): <summary>
```

- Use `fix` for a bug fix, `feat` for a feature, and `perf` for a performance improvement.
- Use `docs`, `test`, `refactor`, `build`, `ci`, or `chore` for other work.
- Use a lowercase scope that names the component, for example `chat` or `markdown`.
- Write the summary in the imperative mood. Keep the title within 72 characters.

For example: `fix(markdown): keep user messages inside their bubbles`.

Use the same format for the pull request title. A pull request with a user-visible change must contain a `fix`, `feat`, or `perf` commit for that change.

## Review and merge

A maintainer reviews each pull request. After approval, the maintainer merges it into `develop` with a merge commit. The merge commit preserves the commit titles for Release Please. The [release procedure](docs/releases.md) describes the steps after the merge.

## License

The project uses the [MIT License](LICENSE). Your contributions use the same license.
