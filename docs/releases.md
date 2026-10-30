# Releases

## Release flow

The release configuration follows [Rush Hour](https://github.com/SphericalKat/rush-hour/blob/main/.github/workflows/release-please.yml).
Release Please opens a release PR after a conventional commit reaches `develop`.
The PR updates the changelog, package versions, Expo version, and native build versions.
The PR title uses `Release Opencoode <version>`.

After the release PR merges, the workflow creates a version tag and a GitHub release.
The same workflow then calls the artifact workflow directly.
This avoids the GitHub restriction on new workflow events from `GITHUB_TOKEN`.
Native builds run on GitHub runners. They do not use this computer or EAS credits.
The workflows contain no test jobs and do not submit apps to stores.

| Asset | Purpose | Requirement |
| --- | --- | --- |
| `opencoode-vX.Y.Z.apk` | Install on Android devices | All four Android signing secrets |
| `opencoode-vX.Y.Z.aab` | Upload through Google Play Console | All four Android signing secrets |
| `opencoode-vX.Y.Z-ios-simulator.tar.gz` | Install in iOS Simulator or SimSlim | No Apple credentials |
| `SHA256SUMS-*.txt` | Verify downloaded files | The related build succeeds |

The iOS archive cannot run on a physical iPhone.
Physical iOS distribution requires an Apple Developer account and a signed device build.
The existing EAS `production` profile supports that separate path after account setup.

Android artifacts use the supplied release key. The workflow never publishes the Expo debug key.
If a signing secret is absent, the workflow skips Android and records the reason in its summary.
I configured all four Android signing secrets during the initial release setup.
I created a separate RSA 2048-bit key for Opencoode with 30-year validity.
I did not reuse another app's key or configure an Expo account.

The private backup is at `~/.config/opencoode/release-signing` on the maintainer's computer.
The directory has mode `0700`. Both files have mode `0600`.

| Backup file | Contents |
| --- | --- |
| `upload-keystore.jks` | Android release key |
| `credentials.json` | Key alias and passwords |

## Configure Android signing

1. Preserve both files from the private backup directory.
2. Save an additional private backup outside this computer.
3. Open the repository's **Settings → Secrets and variables → Actions** page.
4. Restore these repository secrets if necessary.

| Secret | Value |
| --- | --- |
| `RELEASE_KEYSTORE_BASE64` | Base64 content of the upload keystore |
| `RELEASE_STORE_PASSWORD` | Keystore password |
| `RELEASE_KEY_ALIAS` | Alias of the release key |
| `RELEASE_KEY_PASSWORD` | Password of the release key |

Use the same key for future APK updates.
Do not replace the release key for a routine release. A replacement key prevents normal APK updates.
GitHub masks secrets in logs. The workflow removes its temporary keystore after the build.
The repository ignores keystores and platform certificates.
For a new app identity, use the [Android signing procedure](https://developer.android.com/studio/publish/app-signing#generate-key).

## Create a release

1. Merge reviewed feature PRs into `develop` with a merge commit.
2. Open the release PR from Release Please.
3. Review the version and changelog.
4. Merge the release PR.
5. Open **Actions → Release** to view the artifact jobs.
6. Download the assets from the GitHub release.

If the release PR does not appear, enable **Allow GitHub Actions to create and approve pull requests** in repository settings.
The workflow requests `contents: write` and `pull-requests: write` only for its release tasks.
Merge commits preserve the conventional commit messages that Release Please reads.

Native versions use `major * 10000 + minor * 100 + patch` for Android and `X.Y.Z` for iOS.
Minor and patch values must remain below 100. The major value must remain below 10000.
The artifact workflow requires a stable `vX.Y.Z` tag that matches the app version.

## Retry an artifact build

1. Open **Actions → Release artifacts**.
2. Select **Run workflow**.
3. Enter the existing release tag.
4. Select `android`, `ios`, or `all`.
5. Start the workflow.

The workflow replaces assets with the same filename after a successful rebuild.
The workflow does not create another release or change its notes.

## Install the iOS simulator archive

1. Extract the `.tar.gz` archive.
2. Start one simulator through SimSlim.
3. Install the app.

```sh
xcrun simctl install booted Opencoode.app
xcrun simctl launch booted dev.opencoode.mobile
```

## Setup evidence

I inspected the Rush Hour workflow and the current Expo, Release Please, Android, and GitHub documentation.
I did not run a local native build, a workflow, or a test during this setup.
The first release requires a successful run on GitHub before its artifacts receive verification.

References: [Expo CI](https://docs.expo.dev/build/building-on-ci/), [Release Please configuration](https://github.com/googleapis/release-please/blob/main/docs/customizing.md), [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).
