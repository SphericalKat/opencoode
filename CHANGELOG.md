# Changelog

## [1.8.0](https://github.com/SphericalKat/opencoode/compare/v1.7.0...v1.8.0) (2026-11-24)


### Features

* **privacy:** add privacy policy site and in-app links ([4e6fc89](https://github.com/SphericalKat/opencoode/commit/4e6fc89c6853f9da1e1d05f68368b4d2968a3183))
* **privacy:** display privacy policy links in app ([350c10c](https://github.com/SphericalKat/opencoode/commit/350c10cd008ded9e9146bf6257ea3911c4688d32))
* **settings:** add About section with privacy policy and app info ([024a26e](https://github.com/SphericalKat/opencoode/commit/024a26e8d52c87bac15d9c5c22b292b90a811e4c))


### Bug Fixes

* **connection:** close the Servers sheet when recovery succeeds ([1d0f91c](https://github.com/SphericalKat/opencoode/commit/1d0f91c1a44fe0c1377de790eeb28fbd9c05cc53))
* **deps:** update dependency react-native-gesture-handler to ~3.5.0 ([85c5bb6](https://github.com/SphericalKat/opencoode/commit/85c5bb611ab85729580e2e061901454085ab1229))
* **deps:** update dependency react-native-gesture-handler to ~3.5.0 ([e769780](https://github.com/SphericalKat/opencoode/commit/e769780e50be0bd13342704fcdf45fb951ad9623))
* **privacy:** center privacy policy button on connection screen ([076b708](https://github.com/SphericalKat/opencoode/commit/076b70891265ce848602605309394f3517983c69))
* **privacy:** resolve review findings and fix Pages deploy ([73bcb02](https://github.com/SphericalKat/opencoode/commit/73bcb0261697f5186e2c5a50355ae1915a770aca))
* **settings:** forget the old section when the server changes ([2f7a961](https://github.com/SphericalKat/opencoode/commit/2f7a961a36427210aecda06152f099778868231d))
* **settings:** return settings to its first screen on server change ([de046a6](https://github.com/SphericalKat/opencoode/commit/de046a64120de0fdcda5ecdc29212bea6aa1b864))

## [1.7.0](https://github.com/SphericalKat/opencoode/compare/v1.6.0...v1.7.0) (2026-11-14)


### Features

* **changes:** add file-type icons from the upstream sprite ([a2d64b3](https://github.com/SphericalKat/opencoode/commit/a2d64b35b7ab6358c943eb455d290933b08e118d))
* **changes:** open a changed file from its diff summary ([b3e35f0](https://github.com/SphericalKat/opencoode/commit/b3e35f085a654d73509ee1cccbc2c0d3923783f9))
* **changes:** parse patches into numbered diff rows ([f9e7635](https://github.com/SphericalKat/opencoode/commit/f9e76357d95d10b2c92d33ee37dc0de505d3de9e))
* **changes:** show diffs inline under each changed file ([a842614](https://github.com/SphericalKat/opencoode/commit/a842614f1697543a1dc20deb7dd933f011d1565d))
* **chat:** add transcript logic module ([554d04a](https://github.com/SphericalKat/opencoode/commit/554d04a304dbfed4f033f11d3299723c7d4d05b6))
* **chat:** name the provider and offer fixes on a failed turn ([ecb624f](https://github.com/SphericalKat/opencoode/commit/ecb624f0a0d58900a409f61c513ee519f359ec97))
* **chat:** open a context menu on message long-press ([533969e](https://github.com/SphericalKat/opencoode/commit/533969e3811b4989484215ddc0f71814938e938d))
* **composer:** pick the agent from a chip menu ([2217d3d](https://github.com/SphericalKat/opencoode/commit/2217d3de4bb5fe0d6ba79d600645f4d0cd6c5c25))
* **composer:** replace message tools page with upstream touch bar ([ed46347](https://github.com/SphericalKat/opencoode/commit/ed463473c929f719f31b7923854c616745233b54))
* **models:** group the model picker by provider ([28c72cc](https://github.com/SphericalKat/opencoode/commit/28c72cc88d8c801a6d53edf43fde7466cab0050e))
* **models:** link model picker to model and provider settings ([2942462](https://github.com/SphericalKat/opencoode/commit/2942462803d8c351baf25077dba61d6c8f216f03))
* **sessions:** open a context menu on session long-press ([ccb610a](https://github.com/SphericalKat/opencoode/commit/ccb610a8e226f4c1a560de7898f74c9b5180c78b))
* **sessions:** replace the projects sheet with an anchored dropdown ([74ac99d](https://github.com/SphericalKat/opencoode/commit/74ac99da1cd3d519f2a0906c62d5c6476f5b6de0))
* **sessions:** show unread as a dot on the project avatar ([1583605](https://github.com/SphericalKat/opencoode/commit/15836054e12ec85b09cd666ac01081ea18bb6b20))
* **syntax:** highlight code by line for diffs ([c3862a8](https://github.com/SphericalKat/opencoode/commit/c3862a8c85a94f9519f75d5e584587c8cd0f1056))
* **terminal:** show shells as closable chips with a new-shell button ([51a5fb4](https://github.com/SphericalKat/opencoode/commit/51a5fb4500181877b65cc5d18cc512b11abcbbe8))
* **terminal:** type into the terminal directly and take control on tap ([ac2b66c](https://github.com/SphericalKat/opencoode/commit/ac2b66c5ba6f61e59f0e8f3f753957a68a960bb1))
* **theme:** add shared surface, diff, switch and avatar tokens ([9eb9051](https://github.com/SphericalKat/opencoode/commit/9eb9051366258e82e99a6f83ee954546f342f9f4))
* **ui:** add anchored menu with Material placement ([cc6deec](https://github.com/SphericalKat/opencoode/commit/cc6deecdee11e05aed4dd817c02fdd0e63051769))
* **ui:** add IconButton primitive ([0a029ef](https://github.com/SphericalKat/opencoode/commit/0a029ef4c717eb41318b1ff698cc9cf7d64bcc01))
* **ui:** add shared ShellIcon glyphs ([ba0c51a](https://github.com/SphericalKat/opencoode/commit/ba0c51a9ce9b9a4a2516c97a4cedf75e76c016f9))
* **ui:** add switch, segmented control and select menu ([528b6c5](https://github.com/SphericalKat/opencoode/commit/528b6c5b86248ea8b34c82a00eaa56eacdeafac4))
* **ui:** add undo snackbar primitive ([1980217](https://github.com/SphericalKat/opencoode/commit/19802174a30ee8139e65bbe507d59be80c6eed99))
* **ui:** undo removals with a snackbar ([22efd1d](https://github.com/SphericalKat/opencoode/commit/22efd1d95fc78e239bf282c3475b24ccddf05a9c))


### Bug Fixes

* **chat:** group session details into cards with values ([3d0aae1](https://github.com/SphericalKat/opencoode/commit/3d0aae14cdf32752459c02e3b3592c51fa556990))
* **chat:** make jump to latest a small centered chip ([fee8532](https://github.com/SphericalKat/opencoode/commit/fee8532741b5a51cf6a10ebce0950ce5978ad05d))
* **chat:** show a failed turn's error once with a warning icon ([c9d98a5](https://github.com/SphericalKat/opencoode/commit/c9d98a5b93f9053706d33a89df5d8b75659de5e1))
* **chat:** show model switches as separators ([ee764be](https://github.com/SphericalKat/opencoode/commit/ee764be91efd7bc02d105500881bb3b5a8bbf243))
* **chat:** show session statistics as labeled rows ([090877d](https://github.com/SphericalKat/opencoode/commit/090877ddd5fd926c8f66aeceb851b3e8ee98a68b))
* **chat:** show tool input and output in one wrapped card ([395abfb](https://github.com/SphericalKat/opencoode/commit/395abfbdcc499e5e373190e90a5cdbc012b148c0))
* **chat:** show tool rows as title and faint subtitle under a rail ([71603db](https://github.com/SphericalKat/opencoode/commit/71603db2a781e0cf940535ae1d240c6e494827ee))
* **chat:** size the model sheet to its content and fade its list ([f5a63e2](https://github.com/SphericalKat/opencoode/commit/f5a63e2907f49c99f9c81d7cedd885bb8543ad93))
* **composer:** fade the chip row where it scrolls out of view ([9261b82](https://github.com/SphericalKat/opencoode/commit/9261b82efa41924e003d6496f850acb1e66ea8d2))
* **composer:** match upstream composer frame, input and model chips ([5521e79](https://github.com/SphericalKat/opencoode/commit/5521e79e57fe8b17abc5071cc36269fc6089f026))
* **composer:** move add menu and send button into the composer card ([cc8b7a5](https://github.com/SphericalKat/opencoode/commit/cc8b7a52e91e9a17ee00ce188402a012e4d3d1cd))
* **composer:** show model variants as a grouped list ([801ef16](https://github.com/SphericalKat/opencoode/commit/801ef165bff5c76068f3524d98eb143ad4db7ea4))
* **connection:** ask for address and password on one screen ([f623646](https://github.com/SphericalKat/opencoode/commit/f62364682628b257e43e931df81680517bc7f40e))
* **markdown:** drop code block language label and scrollbar ([b61c7e2](https://github.com/SphericalKat/opencoode/commit/b61c7e2d2c54011cff3280e866593d5ff0af8c58))
* **markdown:** render file paths as code links and keep inline code on the baseline ([7abdcf1](https://github.com/SphericalKat/opencoode/commit/7abdcf13dbfe5c9192b2ec2911589856ff84b0bb))
* **markdown:** size table columns to content with upstream table styling ([6047109](https://github.com/SphericalKat/opencoode/commit/60471098dc5ca2de22ad0771e759ffda1c9aeaef))
* **sessions:** label untitled sessions New session everywhere ([f17935d](https://github.com/SphericalKat/opencoode/commit/f17935d94fc97b6d2a5c9656fe702e19d414882a))
* **sessions:** stop showing Load more after the last page ([964391d](https://github.com/SphericalKat/opencoode/commit/964391d52cce83ce41dca10d5dac22034506fe98))
* **settings:** keep setting controls beside their labels ([7438283](https://github.com/SphericalKat/opencoode/commit/7438283697d67c12a6fde05f26beb79803f722cf))
* **settings:** replace the settings index with a back bar and section menu ([8fa2f02](https://github.com/SphericalKat/opencoode/commit/8fa2f028de813014a76c51359d73fd315cf5cd1f))
* **settings:** show Look and feel as one grouped list ([cb14736](https://github.com/SphericalKat/opencoode/commit/cb14736091ab4ce9f7356ec32d1a95b70a7a16b7))
* **settings:** use grouped lists in every settings section ([c63f379](https://github.com/SphericalKat/opencoode/commit/c63f379d1496356307f97c5a69a3632ad39cec25))
* **sheets:** close sheets after a theme change ([b0354d8](https://github.com/SphericalKat/opencoode/commit/b0354d8a70068de09cfe9246298d62ecd4a6b9f2))
* **sheets:** match upstream sheet chrome and add list sheets ([ab6750d](https://github.com/SphericalKat/opencoode/commit/ab6750d8df5a4d7c13059447c8c6af9b4ebdec05))
* **terminal:** paint rows below the grid with the theme background ([00b3096](https://github.com/SphericalKat/opencoode/commit/00b3096a5aa136bb49ba4b2850422381cd4e6595))
* **ui:** align the app with the OpenCode web app design ([e0027c1](https://github.com/SphericalKat/opencoode/commit/e0027c118c2d961b8921999b25e4bae3ea46c9c6))
* **ui:** fade the edges of horizontal scrollers ([c328129](https://github.com/SphericalKat/opencoode/commit/c3281295b7558ccb2ac611fd2fdc9ba39fe2a542))
* **ui:** flatten buttons and use Android ripple ([c668fd2](https://github.com/SphericalKat/opencoode/commit/c668fd250730f5118b85366a94db06b0ead69d23))
* **ui:** hide scroll indicators on short lists ([057a0a4](https://github.com/SphericalKat/opencoode/commit/057a0a4e1e900c5afdd167ac265a5cc6bb08cc26))
* **ui:** line up buttons with the controls beside them ([7fc9272](https://github.com/SphericalKat/opencoode/commit/7fc927261d96b9e66ad465a65f98cab599ac36ad))
* **ui:** replace system alerts with themed dialogs ([bcbe000](https://github.com/SphericalKat/opencoode/commit/bcbe000d2921d30ed85850d4eed32c26f833da07))
* **ui:** show segment labels when a segmented control fits its content ([950b6df](https://github.com/SphericalKat/opencoode/commit/950b6dfdb2ee42d1e099a056c445abc71679a1fd))
* **ui:** size menus to their longest label ([f19f683](https://github.com/SphericalKat/opencoode/commit/f19f683c5a0cf862882d294463866dd420bd33ee))
* **workspace:** use real icons in Files and mark the current worktree ([412f3ee](https://github.com/SphericalKat/opencoode/commit/412f3ee18ceb446f438ebb5291f3c6e46b0e7803))

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
