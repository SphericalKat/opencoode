# Android APK size

## Measured baseline

I inspected the signed APK from [v1.3.0](https://github.com/SphericalKat/opencoode/releases/tag/v1.3.0).
The file contains 123,427,813 bytes, or 117.71 MiB.
The v1.4.0 source updates the icon, release workflow, and version metadata without changes to runtime dependencies.

| Payload | Bytes in the ZIP entries | MiB |
| --- | ---: | ---: |
| Native libraries, all four ABIs | 109,781,560 | 104.70 |
| Hermes JavaScript bundle | 4,864,592 | 4.64 |
| DEX code | 3,710,212 | 3.54 |
| Android resources, including fonts and resource table | 2,946,175 | 2.81 |
| Other assets | 884,281 | 0.84 |
| Other ZIP entries | 161,837 | 0.15 |
| ZIP headers, alignment, and signing overhead | 1,079,156 | 1.03 |

The native libraries account for 88.94% of the APK file.
The APK stores those libraries without compression for direct loading from the APK.
Each device uses only one of the four ABI trees.

| ABI | Native library bytes | Native libraries, MiB | Estimated APK, MiB |
| --- | ---: | ---: | ---: |
| `arm64-v8a` | 28,701,320 | 27.37 | 40.4 |
| `armeabi-v7a` | 19,691,732 | 18.78 | 31.8 |
| `x86_64` | 30,339,504 | 28.93 | 41.9 |
| `x86` | 31,049,004 | 29.61 | 42.6 |

These estimates retain the shared payload and the full original APK overhead.
They exclude potential savings from R8 and resource shrinking.
They are estimates from the existing ZIP, not measurements of rebuilt APKs.
The ARM64 estimate is about 66% smaller than the universal APK.

## Largest native components

React Native, the barcode scanner, Hermes, and app modules account for the largest native files.
The barcode scanner supports the connection QR flow.
I inspected the ARM64 libraries `libreactnative.so`, `libbarhopper_v3.so`, `libhermesvm.so`, and `libappmodules.so`.
Those four files contain no `.debug_*` or `.symtab` sections.
I found no unstripped debug payload in those files.

The two fonts occupy 526,319 compressed bytes under Android resources.
The barcode models occupy most of the other assets.
Neither the fonts nor app images explain the 118 MiB APK.

## Release changes

I enabled four ABI-specific APKs in the CI Gradle script and disabled the universal APK.
I added certificate verification for each APK and artifact sizes to the workflow summary.
I enabled R8 code optimization and resource shrinking through `expo-build-properties`.

I retained uncompressed native libraries and Hermes bytecode to preserve direct loading and startup performance.
I retained GIF and WebP decoders because chat attachments and workspace previews support those formats.
The AAB contains all supported ABIs for Google Play delivery.

I did not run automated tests or a native build for this analysis.
The next release build supplies the measured size after these changes.

References: [Android ABI splits](https://developer.android.com/build/configure-apk-splits), [Expo app size](https://docs.expo.dev/distribution/app-size/), [Android app optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization).
