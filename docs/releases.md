# Releases

## Release flow

The release configuration follows [Rush Hour](https://github.com/SphericalKat/rush-hour/blob/main/.github/workflows/release-please.yml). Release Please opens a release PR after a conventional commit reaches `develop`. The PR updates the changelog, package versions, Expo version, and native build versions. The PR title uses `Release Opencoode <version>`.

After the release PR merges, the workflow creates a version tag and a GitHub release. The same workflow then calls the artifact workflow directly. This avoids the GitHub restriction on new workflow events from `GITHUB_TOKEN`. Native builds run on the maintainer's computer if its runner is online, and on GitHub runners otherwise. See [Self-hosted Android runner](#self-hosted-android-runner). Native builds do not use EAS credits. The workflows contain no test jobs and do not submit apps to stores.

The Android job uses `pnpm/setup@v3.1.2` to install Node.js 26 and the pnpm version from `package.json`. The action caches the pnpm store through `pnpm-lock.yaml`. The job uses `pnpm install --frozen-lockfile` and `pnpm exec expo prebuild`. Dependency changes require an updated lockfile before the release.

| Asset | Purpose | Requirement |
| --- | --- | --- |
| `opencoode-vX.Y.Z-arm64-v8a.apk` | Install on 64-bit ARM devices | All four Android signing secrets |
| `opencoode-vX.Y.Z-armeabi-v7a.apk` | Install on 32-bit ARM devices | All four Android signing secrets |
| `opencoode-vX.Y.Z-x86_64.apk` | Install on 64-bit Intel devices or emulators | All four Android signing secrets |
| `opencoode-vX.Y.Z-x86.apk` | Install on 32-bit Intel devices or emulators | All four Android signing secrets |
| `opencoode-vX.Y.Z.aab` | Upload through Google Play Console | All four Android signing secrets |
| `SHA256SUMS-*.txt` | Verify downloaded files | The related build succeeds |

Android artifacts use the supplied release key. The workflow never publishes the Expo debug key. The CI Gradle script creates one APK per ABI and disables the universal APK. The APKs store compressed native libraries for a smaller download. The AAB stores uncompressed native libraries, because Google Play compresses its downloads. The workflow checks the signing certificate of each APK before upload. All four APKs retain the same app version and signing key for normal updates. The AAB retains all four ABIs. Google Play selects the libraries for each device. The Expo configuration enables R8 and resource shrinking for release builds. The workflow records artifact sizes in its summary. See the [APK size analysis](android-size.md) for the baseline. If a signing secret is absent, the workflow skips Android and records the reason in its summary. I configured all four Android signing secrets during the initial release setup. I created a separate RSA 2048-bit key for Opencoode with 30-year validity. I did not reuse another app's key or configure an Expo account.

The private backup is at `~/.config/opencoode/release-signing` on the maintainer's computer. The directory has mode `0700`. Both files have mode `0600`.

| Backup file           | Contents                |
| --------------------- | ----------------------- |
| `upload-keystore.jks` | Android release key     |
| `credentials.json`    | Key alias and passwords |

## Configure Android signing

1. Preserve both files from the private backup directory.
2. Save an additional private backup outside this computer.
3. Open the repository's **Settings → Secrets and variables → Actions** page.
4. Restore these repository secrets if necessary.

| Secret                    | Value                                 |
| ------------------------- | ------------------------------------- |
| `RELEASE_KEYSTORE_BASE64` | Base64 content of the upload keystore |
| `RELEASE_STORE_PASSWORD`  | Keystore password                     |
| `RELEASE_KEY_ALIAS`       | Alias of the release key              |
| `RELEASE_KEY_PASSWORD`    | Password of the release key           |

Use the same key for future APK updates. Do not replace the release key for a routine release. A replacement key prevents normal APK updates. GitHub masks secrets in logs. The workflow removes its temporary keystore after the build. The repository ignores keystores and platform certificates. For a new app identity, use the [Android signing procedure](https://developer.android.com/studio/publish/app-signing#generate-key).

## Create a release

1. Merge reviewed feature PRs into `develop` with a merge commit.
2. Open the release PR from Release Please.
3. Review the version and changelog.
4. Merge the release PR.
5. Open **Actions → Release** to view the artifact jobs.
6. Download the assets from the GitHub release.

If the release PR does not appear, enable **Allow GitHub Actions to create and approve pull requests** in repository settings. The workflow requests `contents: write` and `pull-requests: write` only for its release tasks. Merge commits preserve the conventional commit messages that Release Please reads.

Native versions use `major * 10000 + minor * 100 + patch` for Android and `X.Y.Z` for iOS. Minor and patch values must remain below 100. The major value must remain below 10000. The artifact workflow requires a stable `vX.Y.Z` tag that matches the app version.

## Retry an artifact build

1. Open **Actions → Release artifacts**.
2. Select **Run workflow**.
3. Enter the existing release tag.
4. Start the workflow.

The workflow replaces assets with the same filename after a successful rebuild. The workflow does not create another release or change its notes.

## Self-hosted Android runner

The `prepare` job selects the runner for the Android job. If a runner with the `opencoode-pc` label is online, the Android job runs on it. Otherwise, the Android job runs on `ubuntu-latest`. The job summary records the selected runner.

GitHub does not fall back from an offline self-hosted runner. A job that targets one waits in the queue. For this reason, `prepare` reads the runner status before the Android job starts. A busy runner counts as online, so the Android job waits for it. If the computer goes offline during a build, the build fails. Rerun it through [Retry an artifact build](#retry-an-artifact-build).

The runner status requires the `RUNNER_STATUS_TOKEN` repository secret. `GITHUB_TOKEN` cannot list runners. If the secret is absent, the Android job always uses `ubuntu-latest`.

### Create the status token

1. Open **GitHub → Settings → Developer settings → Fine-grained tokens**.
2. Generate a token with access to `SphericalKat/opencoode` only.
3. Grant the **Administration: Read-only** repository permission.
4. Save the token as the `RUNNER_STATUS_TOKEN` Actions secret in this repository.

### Runner installation

The runner follows the [GitHub procedure to add a self-hosted runner](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).

| Property     | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Directory    | `~/actions-runner`                                       |
| Runner name  | `crucible`                                               |
| Labels       | `self-hosted`, `Linux`, `X64`, `opencoode-pc`            |
| systemd unit | `actions.runner.SphericalKat-opencoode.crucible.service` |
| Service user | `sphericalkat`                                           |

The systemd unit starts at boot. The runner `.env` and `.path` files contain only `LANG` and the system `PATH`. The setup actions install Java, the Android SDK, and Node.js for each job.

On a self-hosted runner, Gradle uses one worker for each CPU thread. On GitHub runners, Gradle keeps the limit of two workers.

On a self-hosted runner, the Android job does not read or write the GitHub Actions cache. Gradle uses `~/.gradle` and its local build cache. pnpm uses its local store. The runner runs as `sphericalkat`, so release builds share these directories with local builds.

### Manage the runner

Run these commands in `~/actions-runner`:

| Action | Command |
| --- | --- |
| Show the status | `sudo ./svc.sh status` |
| Stop the runner | `sudo ./svc.sh stop` |
| Start the runner | `sudo ./svc.sh start` |
| Turn off start at boot | `sudo systemctl disable actions.runner.SphericalKat-opencoode.crucible.service` |
| Remove the service | `sudo ./svc.sh uninstall` |

If you stop the runner, new release builds use `ubuntu-latest`. To remove the runner from GitHub, stop and uninstall the service first. Then run `./config.sh remove --token <token>` with a token from `gh api -X POST repos/SphericalKat/opencoode/actions/runners/remove-token --jq .token`.

### Security

This repository is public. GitHub recommends self-hosted runners only for private repositories. A pull request from a fork can change a workflow to target the `opencoode-pc` label. That workflow then runs on this computer. The repository requires approval for fork pull request workflows from first-time contributors only. Do not approve a fork workflow that targets a self-hosted runner.

## Setup evidence

I inspected the Rush Hour workflow and the current Expo, Release Please, Android, and GitHub documentation. I did not run a local native build, a workflow, or a test during this setup. The first release requires a successful run on GitHub before its artifacts receive verification.

References: [Expo CI](https://docs.expo.dev/build/building-on-ci/), [Release Please configuration](https://github.com/googleapis/release-please/blob/main/docs/customizing.md), [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).
