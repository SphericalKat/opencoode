# Changelog

## [1.6.0](https://github.com/SphericalKat/opencoode/compare/v1.5.1...v1.6.0) (2026-11-13)


### Features

* **app:** use the beta layout on every platform and width ([fff1ac5](https://github.com/SphericalKat/opencoode/commit/fff1ac57a9266615013206a46858e48691c11a82))
* **app:** use the beta layout on every platform and width ([b80195e](https://github.com/SphericalKat/opencoode/commit/b80195e8e607772731cf4108b7421272fd4c7045))
* **chat:** add stream reveal chunk model for streamed text ([63d073b](https://github.com/SphericalKat/opencoode/commit/63d073b3a5013c919a6dc6d5f5a0456ea333b98e))
* **chat:** fade in streamed reply text chunk by chunk ([77e7caf](https://github.com/SphericalKat/opencoode/commit/77e7cafc534a2b43124ac5496a726478c13b6fe8))
* **chat:** fade in streamed reply text while it arrives ([f0e0760](https://github.com/SphericalKat/opencoode/commit/f0e0760d3e1d50e4386ea13289d75475412fcdf0))
* **haptics:** add haptic feedback for streaming and key actions ([f2f2c3c](https://github.com/SphericalKat/opencoode/commit/f2f2c3c46e8dcc36ca599699b8ff1a3bc9f7b172))
* **haptics:** tick while responses stream and on key actions ([09ab5ed](https://github.com/SphericalKat/opencoode/commit/09ab5edb4f9ea9175f5227bc7403afbd226a561a))
* **markdown:** fade in streamed text chunk by chunk ([74eba86](https://github.com/SphericalKat/opencoode/commit/74eba8635b2cfb23257352f80d869af04c9a3ca4))
* **markdown:** release buffered stream text word by word ([f73da4d](https://github.com/SphericalKat/opencoode/commit/f73da4d8f16bd752ae975d0196a849bc862b3bcd))
* **settings:** refine Configuration action list and disclosure ([b914708](https://github.com/SphericalKat/opencoode/commit/b91470870ab05642b157eebf5a00781da18101b8))
* **settings:** rename Appearance to Look and feel for the haptics switch ([3741665](https://github.com/SphericalKat/opencoode/commit/374166590b7ab5ca83ada49b25c68e6653e4499a))
* **theme:** accent the send button and active tab in Material You ([2e274ba](https://github.com/SphericalKat/opencoode/commit/2e274ba32544fed1b5b799d37c111016d5d18625))
* **theme:** accent the send button and active tab in Material You ([c64fe34](https://github.com/SphericalKat/opencoode/commit/c64fe3490ff84fbf64c87f9a52778fb0434462d4))
* **ui:** add secure input visibility toggles ([ccdca4d](https://github.com/SphericalKat/opencoode/commit/ccdca4dfd0b75d649746886958fbf0b315cb825e))
* **ui:** improve scrolling, spacing, and inputs in chat and settings ([3da1136](https://github.com/SphericalKat/opencoode/commit/3da1136c62225888897dcde19a0a972cb24eeeae))


### Bug Fixes

* **chat:** align copy buttons and code block padding ([b1cff2d](https://github.com/SphericalKat/opencoode/commit/b1cff2dd19c60922e70264a923b628f588a3b3c9))
* **chat:** align copy buttons and code block padding ([8a4dfd5](https://github.com/SphericalKat/opencoode/commit/8a4dfd5d82d3296e0e26d3a2e7c7b09bbba65ac2))
* **chat:** edit an earlier message by reverting from it ([03905ff](https://github.com/SphericalKat/opencoode/commit/03905fffdbcbb12fe0ad1bfb3ef430ec062525e4))
* **chat:** edit an earlier message by reverting from it ([b4b2c21](https://github.com/SphericalKat/opencoode/commit/b4b2c211662137d806b213782fd83e7fe2ac8d53))
* **chat:** make message long-press feel native ([3f1ab57](https://github.com/SphericalKat/opencoode/commit/3f1ab577d3030ee9d6022c05a18fba6b99c34146))
* **chat:** show a ripple while a message is pressed ([c82fe47](https://github.com/SphericalKat/opencoode/commit/c82fe472ad7b7da531dd4827653441d60ec1f052))
* **chat:** show the selection bar over the tab strip without moving the transcript ([4e57d20](https://github.com/SphericalKat/opencoode/commit/4e57d20a0a0bc0d88758526cec782d29118b6971))
* **haptics:** match the haptics switch thumb to the palette ([814b95b](https://github.com/SphericalKat/opencoode/commit/814b95b5158d8d3842319651b076abf475d00e8f))
* **haptics:** pace streaming ticks evenly between text bursts ([4f5a579](https://github.com/SphericalKat/opencoode/commit/4f5a57986ad9c28bf5c9b309e00de384cce6550c))
* **markdown:** enable nested horizontal code scrolling ([cb10c38](https://github.com/SphericalKat/opencoode/commit/cb10c38de10d3fe5ab06e0d57ec24dd4c7005cda))
* **markdown:** let code blocks and tables scroll inside message rows ([0ebf953](https://github.com/SphericalKat/opencoode/commit/0ebf9539c6f306cfd1d6a5520d08154621b7c9ea))
* **navigation:** center the tab strip chevron on the lowercase letters ([aa5eb0e](https://github.com/SphericalKat/opencoode/commit/aa5eb0e0398e604fb65ee35d4a1d5dfbf624b135))
* **navigation:** put the tab strip chevron beside the title ([b4d0838](https://github.com/SphericalKat/opencoode/commit/b4d0838223465e80a8089a8afd55cefc01658981))
* **navigation:** put the tab strip chevron beside the title and add a ripple ([d65717d](https://github.com/SphericalKat/opencoode/commit/d65717d6d399cfda4f5f91598ef70b530bcf8ce4))
* **navigation:** replace the tab strip count and slide sheets up ([0f2c9c5](https://github.com/SphericalKat/opencoode/commit/0f2c9c597ae19a39c31e3138bf18f9e8391dfbf5))
* **navigation:** show a chevron instead of the tab count in the tab strip ([42a2cd5](https://github.com/SphericalKat/opencoode/commit/42a2cd5c42aa8bb97a8776386481248b2c69a46d))
* **navigation:** use an up-and-down chevron on the tab strip ([8acf492](https://github.com/SphericalKat/opencoode/commit/8acf492d4549857dcaf36ff0344a109d439bbfb1))
* **release:** pass the runner choice as a boolean job output ([6e579e6](https://github.com/SphericalKat/opencoode/commit/6e579e613b94844405920b8960830796083c933c))
* **release:** pass the runner choice as a boolean job output ([94e9cb3](https://github.com/SphericalKat/opencoode/commit/94e9cb3b0e8abec33e681d564c5c3e558cb6f6ed))
* **settings:** preserve the MCP remove touch area ([f6e1fb8](https://github.com/SphericalKat/opencoode/commit/f6e1fb8a850f138f67edb0fb443a4ba03f35dd2d))
* **sheets:** drag and dismiss bottom sheets with gorhom bottom sheet ([31e7a9e](https://github.com/SphericalKat/opencoode/commit/31e7a9eb1fd565ad33daef877dc54077b80efc1b))
* **sheets:** drag and dismiss sheets without re-rendering the app ([c48b54a](https://github.com/SphericalKat/opencoode/commit/c48b54ac582f068fd7bc031145b7e077bf9435a1))
* **ui:** align Disclosure and simplify tool arguments ([1654b42](https://github.com/SphericalKat/opencoode/commit/1654b42d9bd8875b74962090a472154b664242c3))
* **ui:** balance compact buttons and settings cards ([809b4a2](https://github.com/SphericalKat/opencoode/commit/809b4a2fa7073adc0491c5ece5fd3ea3d60934fa))
* **ui:** resolve code review findings across UI and settings ([d674b5e](https://github.com/SphericalKat/opencoode/commit/d674b5ef922a270c56f9ee0c4040f1585c1690ab))
* **ui:** slide short sheets up from the bottom instead of fading them in ([a3d3e61](https://github.com/SphericalKat/opencoode/commit/a3d3e61417a0188b3116d3e25d48ce98abf77526))


### Performance Improvements

* **markdown:** run streamed text fades on the UI thread ([d439d8c](https://github.com/SphericalKat/opencoode/commit/d439d8cb98ff18f10588deb3790b1b9dcc47dfe7))
* **navigation:** keep sheet toggles from re-rendering the app ([2932ebc](https://github.com/SphericalKat/opencoode/commit/2932ebca0837c036079ee3eb35e6625c60704f45))

## [1.5.1](https://github.com/SphericalKat/opencoode/compare/v1.5.0...v1.5.1) (2026-11-13)


### Bug Fixes

* **chat:** stop image placeholder from crashing Android ([c7435a4](https://github.com/SphericalKat/opencoode/commit/c7435a48ed5476a93d19c3ebbf199c29258c8014))
* **chat:** stop image placeholder from crashing Android ([ca2d859](https://github.com/SphericalKat/opencoode/commit/ca2d8596ecbdc391e067492fbe710710ec7f3fc7))

## [1.5.0](https://github.com/SphericalKat/opencoode/compare/v1.4.0...v1.5.0) (2026-11-13)


### Features

* **navigation:** add server shortcut to tabs sheet ([84a041b](https://github.com/SphericalKat/opencoode/commit/84a041b2b0ddd22628de9742fbbf37e231a018aa))
* **navigation:** add server shortcut to tabs sheet ([daac813](https://github.com/SphericalKat/opencoode/commit/daac813497f1975e81047f4b832571d221848fea))
* show tool-result images automatically in conversations ([b2800b4](https://github.com/SphericalKat/opencoode/commit/b2800b4fe61de1f178824e96c93d36017541235d))
* **theme:** add palettes and syntax colors ([ee0bbb4](https://github.com/SphericalKat/opencoode/commit/ee0bbb4cddb9d0ee3926e1eddfd7fdb10291491e))
* **theme:** add palettes and syntax colors ([058eec0](https://github.com/SphericalKat/opencoode/commit/058eec0c3c91fea4f8d76f2c2398745ff48253cc))


### Bug Fixes

* **connection:** show timeout guidance when server discovery times out ([c55ed19](https://github.com/SphericalKat/opencoode/commit/c55ed190f82958fa7ed0e7ca5f6afcbb874e1dc2))
* **deps:** update dependency @opencode/client to v2.2.7 ([19365fd](https://github.com/SphericalKat/opencoode/commit/19365fd91b708d54aabd70e3f59f6510408b6efc))
* **deps:** update dependency @opencode/client to v2.2.7 ([b0984dc](https://github.com/SphericalKat/opencoode/commit/b0984dc93319cf01d0b1f975ccd69c6b3b484b43))
* **deps:** update dependency react-native-keyboard-controller to v1.23.0 ([1ecf038](https://github.com/SphericalKat/opencoode/commit/1ecf038f11a434c39f23bab53c80dff879a87a9e))
* **deps:** update dependency react-native-keyboard-controller to v1.23.0 ([16fa745](https://github.com/SphericalKat/opencoode/commit/16fa745532117d84a6267e7eff6462ccf73444c4))
* **deps:** update dependency react-native-svg to v15.16.1 ([55837f3](https://github.com/SphericalKat/opencoode/commit/55837f36d8a955fc7902776f77f46817ab6f57d4))
* **deps:** update dependency react-native-svg to v15.16.1 ([d65e802](https://github.com/SphericalKat/opencoode/commit/d65e80200e11284914c72afd9cce7fd938c4b8a5))
* **release:** build the app bundle without ABI splits ([75653ff](https://github.com/SphericalKat/opencoode/commit/75653ff1940aa01b19f28e615d25876fb9450945))
* retain artifact retries for existing universal APK releases ([efd478f](https://github.com/SphericalKat/opencoode/commit/efd478fc3d8147f1f251fa965090c9532896e46d))
* **theme:** preserve default frames and space fixture controls ([40d687f](https://github.com/SphericalKat/opencoode/commit/40d687f52241f526e0cad5e660b7bc5ef6e6d81b))


### Performance Improvements

* reduce Android release size with ABI splits and R8 ([9c9bb26](https://github.com/SphericalKat/opencoode/commit/9c9bb26896c30cd8aee1f137e1689aeacb746220))
* **release:** compress native libraries in GitHub APKs ([453715a](https://github.com/SphericalKat/opencoode/commit/453715a74936b6a366bff36eabfb55f256c41595))
* **release:** ship compressed per-ABI APKs on GitHub ([30b6dea](https://github.com/SphericalKat/opencoode/commit/30b6dea55bbe09e051bf2c7f823c964a29c34d9f))

## [1.4.0](https://github.com/SphericalKat/opencoode/compare/v1.3.0...v1.4.0) (2026-10-30)

### Features

- use the standalone OpenCode app icon on black ([11ab6c8](https://github.com/SphericalKat/opencoode/commit/11ab6c861e1cd495f3298915fa46f509b09a5a55))

### Bug Fixes

- compare Android signing certificates without display labels ([19c448a](https://github.com/SphericalKat/opencoode/commit/19c448a491a62ab331250d99ec13a02260126d3d))
- queue release artifacts separately for each platform ([39a5a64](https://github.com/SphericalKat/opencoode/commit/39a5a64b9988228d4c04c2fd8abc2b51e2900d2d))

## [1.3.0](https://github.com/SphericalKat/opencoode/compare/v1.2.0...v1.3.0) (2026-10-30)

### Features

- animate shared thinking and tool disclosures ([295c440](https://github.com/SphericalKat/opencoode/commit/295c4409f63042d829951bee8ed5cc2d64f7e1b2))
- connect mobile clients to active Pi sessions ([c295a75](https://github.com/SphericalKat/opencoode/commit/c295a757586d51fc7fb2804f814476b51bd293be))
- match desktop tool activity and output rendering ([02d611d](https://github.com/SphericalKat/opencoode/commit/02d611d5f7fc36f367797f3128e1cca916b59545))

### Bug Fixes

- expose Pi model catalog through shared settings ([83d2df5](https://github.com/SphericalKat/opencoode/commit/83d2df5325b8280bc78d51605f32faf1ffd218be))
- flatten message selection and disclosure press feedback ([827afbd](https://github.com/SphericalKat/opencoode/commit/827afbd389e12a18c59fb5f8368346a42d59183a))
- keep Android chat composer above the keyboard ([1987b9a](https://github.com/SphericalKat/opencoode/commit/1987b9ad98368f23d43f1e23cd2c39791d20d057))
- locate Android release signer without ripgrep ([e88a8ac](https://github.com/SphericalKat/opencoode/commit/e88a8ac01c119768053566dbf27039421bc18fe3))
- match beta response controls and compact Pi model selection ([c7f07e5](https://github.com/SphericalKat/opencoode/commit/c7f07e5b04abb7fac89d79aa3cd7d6f713d47be6))
- preserve bottom following after keyboard dismissal ([fdf43f8](https://github.com/SphericalKat/opencoode/commit/fdf43f873fb6b1db0e85dfc2698b5b22c455a091))
- restore grouped settings with native submenu navigation ([f521ba4](https://github.com/SphericalKat/opencoode/commit/f521ba43a32aaf1f055c92ea6d99c371053f2341))
- restore right-aligned user message bubbles ([5de1c72](https://github.com/SphericalKat/opencoode/commit/5de1c7243faab7328614816a89cf5197f07e2bf6))
- use supported Xcode for Expo release builds ([ab6bb90](https://github.com/SphericalKat/opencoode/commit/ab6bb90b76ba3447c92585509b34b4541f5f1dd3))

## [1.2.0](https://github.com/SphericalKat/opencoode/compare/v1.1.0...v1.2.0) (2026-10-30)

### Features

- adopt the OpenCode beta layout on Android phones ([f04de61](https://github.com/SphericalKat/opencoode/commit/f04de61bd1bf350e03c7751d5d580c2acbdbca7a))

### Bug Fixes

- align beta settings and preserve Android navigation intent ([951f21c](https://github.com/SphericalKat/opencoode/commit/951f21c73727b47012d923ebb53a43536f9e28ae))
- align mobile headers and simplify session controls ([777df6b](https://github.com/SphericalKat/opencoode/commit/777df6ba50829c86d69eddb8ece9cc1611ebe635))
- allow the approved OpenCode packages during pnpm installs ([66c117d](https://github.com/SphericalKat/opencoode/commit/66c117da5b7e95b299b2d68a564cea852fd372a3))
- announce failed steps without reporting the agent as ready ([3acf80f](https://github.com/SphericalKat/opencoode/commit/3acf80f613213f65649736151b8e9d0a190734da))
- clarify mobile navigation and use native settings transitions ([3f487b7](https://github.com/SphericalKat/opencoode/commit/3f487b750f4820e4854b65edc25c2dace66030cb))
- **deps:** update dependency react-native-safe-area-context to ~5.11.0 ([e05d4df](https://github.com/SphericalKat/opencoode/commit/e05d4df94f041c514ef8da37f3fae6f8991bbb0f))
- **deps:** update dependency react-native-safe-area-context to ~5.11.0 ([4496fc7](https://github.com/SphericalKat/opencoode/commit/4496fc770cb0e791a71beeb416b6ecc086425dd7))
- **deps:** update react monorepo to v19.3.1 ([db0b67f](https://github.com/SphericalKat/opencoode/commit/db0b67f4bae71846aa1ba614a04385f45cb8225e))
- **deps:** update react monorepo to v19.3.1 ([5497f5a](https://github.com/SphericalKat/opencoode/commit/5497f5a123f70130c312fc611f7b100998737d49))
- fit narrow Markdown tables and expose horizontal scrolling ([b3b6155](https://github.com/SphericalKat/opencoode/commit/b3b61550321c5233b21777fae171c5f8890c9c0e))
- keep chat controls clear of the response ([860ebe2](https://github.com/SphericalKat/opencoode/commit/860ebe292ac6d13becc88c226f06f97a0af83a3e))
- keep the Android composer height stable while reading history ([571070d](https://github.com/SphericalKat/opencoode/commit/571070da4e85a6317ca08de2d244c4153547a59d))
- preserve recycled chat rows and document native UX refinements ([fcae404](https://github.com/SphericalKat/opencoode/commit/fcae40492e3e9682fed5a4fcc9f0b13e801a2d3d))
- preserve settings navigation and center toolbar controls ([4c1bcd9](https://github.com/SphericalKat/opencoode/commit/4c1bcd9a94fd07ea4ee1dbaadaf75fc41b17ed69))
- refine Android sessions around the OpenCode beta layout ([a4b268e](https://github.com/SphericalKat/opencoode/commit/a4b268eb82d38884e79dbf332495126e59b5cbf3))
- refine native chat layout and reading controls ([0f4e6a1](https://github.com/SphericalKat/opencoode/commit/0f4e6a15680f86ad610515d46fe4c01e8e7e3564))
- refine progress feedback and request navigation ([287a828](https://github.com/SphericalKat/opencoode/commit/287a82879628cb9aec3a4f9478e2037c93492391))
- share platform insets across mobile screens ([c8c4f12](https://github.com/SphericalKat/opencoode/commit/c8c4f128e1aa9429935e18d4e02d6c4629abd5d9))
- show accurate agent progress and preserve reading position ([f3925e1](https://github.com/SphericalKat/opencoode/commit/f3925e154bddbe94eded75f6ad7adf091d51263e))

## [1.1.0](https://github.com/SphericalKat/opencoode/compare/v1.0.0...v1.1.0) (2026-10-30)

### Features

- add a cross-platform OpenCode mobile client ([abbf8d5](https://github.com/SphericalKat/opencoode/commit/abbf8d569a1533ded09812f0cd2e619c3e85bdc8))
- add subtle setup and selection transitions ([3843b35](https://github.com/SphericalKat/opencoode/commit/3843b3513ccf6eddf1b750638057a4192677c822))
- select messages with contextual header actions ([ec01f68](https://github.com/SphericalKat/opencoode/commit/ec01f6868f070d3a5bd36bbfdb449df07f03c2be))

### Bug Fixes

- bound settings saves and preserve retryable drafts ([48634b1](https://github.com/SphericalKat/opencoode/commit/48634b1c01d1db12ab90a602b8ca49663c4d6f0d))
- **deps:** update dependency @opencode/client to v2.2.2 ([7deb7c6](https://github.com/SphericalKat/opencoode/commit/7deb7c69eef32a70c935d6d87b63eec4d94c2234))
- **deps:** update dependency @opencode/client to v2.2.2 ([956f307](https://github.com/SphericalKat/opencoode/commit/956f3070fd672397dcac34a24786babcc5e13c13))
- **deps:** update dependency @shopify/flash-list to v2.3.3 ([99945e8](https://github.com/SphericalKat/opencoode/commit/99945e8f398a88b9fe713fd44ef9911c2f3af54a))
- **deps:** update dependency @shopify/flash-list to v2.3.3 ([17b3854](https://github.com/SphericalKat/opencoode/commit/17b3854e5a7e2eaabb6c16f43d8a89c2fab7a90c))
- **deps:** update dependency react-native-keyboard-controller to v1.22.9 ([a80218c](https://github.com/SphericalKat/opencoode/commit/a80218c04a9650893d50b865f874ed85889d2bd4))
- **deps:** update dependency react-native-keyboard-controller to v1.22.9 ([d7b000e](https://github.com/SphericalKat/opencoode/commit/d7b000e76ae8e1010b91dda32e0e4a03c363bcad))
- initialize release signing path inside the runner ([8aae366](https://github.com/SphericalKat/opencoode/commit/8aae366063319d840bb812e0e8acba1f1a3232db))
- keep streamed conversations anchored and selection stable ([11f4a29](https://github.com/SphericalKat/opencoode/commit/11f4a29811d97eb4496d8e869ea577ce532a931b))
- polish session, workspace, and settings flows ([1654bb2](https://github.com/SphericalKat/opencoode/commit/1654bb2a4d1d6cd1cc52409838c1fe746d281276))
- protect unsaved work during server removal ([aa67b49](https://github.com/SphericalKat/opencoode/commit/aa67b49a40a2c7b3ceb4c8f3416e61579bdb623c))
- recover failed servers and preserve open work ([125e684](https://github.com/SphericalKat/opencoode/commit/125e684dc315fd3c9b469aab7bceea090fbeadb3))
- refine connection recovery and modal controls ([ba6335f](https://github.com/SphericalKat/opencoode/commit/ba6335f8e675bf1a350ac4e5a5d0a41d33938bd7))
