# R7 公開候補（C5）

記録日: 2026-09-14
B8 凍結コミット: `47ca861d83d04b063ef1396ce2fd72df64cde4e3`
この記録を含むコミットの後、作業木は `git status --porcelain` が空であること。

## 実行

- コマンド: `pnpm exec vitest run --maxWorkers=2 && pnpm --filter @madou/worker exec vitest run --maxWorkers=2 && pnpm exec playwright test`
- exitCode: `0`
- cases: 6497（failed 0）
- Playwright: 2169 passed
- run: `docs/operations/evidence/2026-09-11-candidate-run.json`
- run sha256: `db7ff051fb3baed2e25ef822dfd0daf83cdf7a10a97785d6c8c7db949fe7c192`

## 台帳

- statuses: pending 6919, accepted 5257, notApplicable 2
- coverageClasses: integrity 6094, semantic 5259, aggregate 825
- strict validator `--require-accepted`: valid
- catalog readiness: `packages/catalog/src/selected/readiness.json`
- readiness sha256: `89ff2f7f0ccb776e1722cd289cc083df840cebdf92c4bff7f4066583d170ac4b`
- readiness.ready: `true`
- ledgerSha256: `aa054feb1546358e9d63927865187a4cd85bb90e4967a6c72247057f699a7520`
- manifestSha256: `faa6b3d7880088f19fc8b956161b0bf683943da347c32cd03e9e06611dd87041`

## 確認した検査

- `pnpm verify:assets`: 成功
- `pnpm typecheck`: 成功
- `pnpm --filter @madou/web build` と `pnpm --filter @madou/worker build`: 成功
- `pnpm verify:catalog`: この候補では未成功。既知の C11 見出し重複と gitignore された原本 PDF 欠落。D2 の freeze 変更にまとめて直す。

## 成果物 sha256

### apps/web/dist

`2bb0da7661782147ef04edbffe1ceb6010df8088ae7f93475366bea64db0d1de` `apps/web/dist/assets/index-D-fNcJWn.css`
`9c66a4986933c29507c3c4014873bfb3f1b95c433452256624b9b4b8e47bb67c` `apps/web/dist/assets/index-DudbfmWU.js`
`b1e1748b2070815ceaf4303feb205e9fa19c4c61cdc02dc7c4577b6c1f1742e3` `apps/web/dist/cards/second/a2-p01-r1c1.webp`
`11887eedc42cfb142db20ac7ed1f4d570375dd2248a26a8fbaf887b4157ff26f` `apps/web/dist/cards/second/a2-p01-r1c2.webp`
`d3bb809c1da324f64c31391b20fda7d23da56b030658e6f11efc9b7b78db4c33` `apps/web/dist/cards/second/a2-p01-r1c3.webp`
`c1d921f4551b83b35a13dfb71b97ecaf91f94591c3240a404089015ce61b203a` `apps/web/dist/cards/second/a2-p01-r2c1.webp`
`f121c57ed3d169e9f7715ce2a589ad645e75ea2c537a72896550a355af21364c` `apps/web/dist/cards/second/a2-p01-r2c2.webp`
`f199d6aa13e94461b5f35ef38eee43fbbd1f024b7d119e12e7aa945b81cdddce` `apps/web/dist/cards/second/a2-p01-r2c3.webp`
`9a4d76c07dd69fb52b26cf4e336fe4645f6199b0ea953e3c89d4307fdf37f3d6` `apps/web/dist/cards/second/a2-p01-r3c1.webp`
`c211704739f622558bd195a47d79328e9b7598b3070f055d1ab23b356307b73e` `apps/web/dist/cards/second/a2-p01-r3c2.webp`
`50a3878277fb84bf7eeba922f9d87c88103f15e87d319608523f07a6baa9a2e0` `apps/web/dist/cards/second/a2-p01-r3c3.webp`
`5f607d29a33821589e6d3cb62e58303c474977ce6f0e7368cd5b9a1a84dfdaaf` `apps/web/dist/cards/second/a2-p02-r1c1.webp`
`692906963cfb97ec74ebeab32d7c57b7861dad52ad7a2bc0d86bffcbbee75192` `apps/web/dist/cards/second/a2-p02-r1c2.webp`
`d58856cc4b22d640a75491f393ac05a0fb1260c14990aa01d9f66fd993b61d75` `apps/web/dist/cards/second/a2-p02-r1c3.webp`
`c84eb2633c4a5a97891c688929863c0802ba06bbc12559790aa9fbca1f7736c7` `apps/web/dist/cards/second/a2-p02-r2c1.webp`
`f54426017085355d8827c8ab35e5a64bed387b181f80f5c7c359a130dc4a8f05` `apps/web/dist/cards/second/a2-p02-r2c2.webp`
`3e3fbc0dd08a6ca6088c96b6469cebcde29d8969837476870743e4bd327ab04a` `apps/web/dist/cards/second/a2-p02-r2c3.webp`
`9c4d738175e30dca7df8d728231e46d0c234665fb82d3aead6d940390edc287b` `apps/web/dist/cards/second/a2-p02-r3c1.webp`
`4128c60056bbcf5b8a4490f2add5c055510b08085e98b8a205bb20f5c17d38fc` `apps/web/dist/cards/second/a2-p02-r3c2.webp`
`e12c86329d0cb335348c422117e8395bda41bbf1edca6f75ea5c5c26ca4d643b` `apps/web/dist/cards/second/a2-p02-r3c3.webp`
`163b3873b198e6bd9c530f91e0fb308a68402ad484c8ee0d44038066bcb7dcb1` `apps/web/dist/cards/second/a2-p03-r1c1.webp`
`eafc4fc57310ae9c32911f858b0245c400d8a3f256fd3e9169c25ceda3dc3940` `apps/web/dist/cards/second/a2-p03-r1c2.webp`
`a00369016c2a8fb903630cc78106313b1bf01a67813f7c3c3fba6a45fef8faca` `apps/web/dist/cards/second/a2-p03-r1c3.webp`
`935647ffb1b237d7f98e613a17b14e8ad35e6f6ddfcba089249699803b5e75d3` `apps/web/dist/cards/second/a2-p03-r2c1.webp`
`35170fd82ed214d7e3c7859de19b15bddbf79a3cf0f0e8d225a7dc0554268b4f` `apps/web/dist/cards/second/a2-p03-r2c2.webp`
`88d1ca35edf9ebf4eb2be396f0ff1421e6b97ab511319b0b1b130b78c0775839` `apps/web/dist/cards/second/a2-p03-r2c3.webp`
`13844b753156a67150f06609a0acf634f994dacc9792e8503e56f074a25c7a63` `apps/web/dist/cards/second/a2-p03-r3c1.webp`
`3e5679c4a8a62ccd4079d6e2301295c3a8688477f730345768172afab5b6e2b3` `apps/web/dist/cards/second/a2-p03-r3c2.webp`
`73ed17ebf3ebe80dfabfd5f70da6e96b96143eed8d895c5a03167457ef9dde6b` `apps/web/dist/cards/second/a2-p03-r3c3.webp`
`ef9f290f32f9d050f4ef8e303fba8e6b939c777850d2727af8ed61e9e7e36edc` `apps/web/dist/cards/second/a2-p04-r1c1.webp`
`bffee963db25ce022c70385fa34282e8fef7a582aefb63fcfef40b5438b84627` `apps/web/dist/cards/second/a2-p04-r1c2.webp`
`9181b6838197140ac116fca557577e9b083f2770fccb8c000e54739ba17f66cb` `apps/web/dist/cards/second/a2-p04-r1c3.webp`
`0c0450c8b36b23273c84a2574ad64cb49cf6bcf4f6f6ffab623aa98fd322725e` `apps/web/dist/cards/second/a2-p04-r2c1.webp`
`a2c4cfce299d2c5b396dc591f16be6b214a65b229c835d6cf0eeb6ab007920a9` `apps/web/dist/cards/second/a2-p04-r2c2.webp`
`8625a9f169fda943cb2ae4f4c6881313f2db6884b1199a273ef7e4cf02ec7529` `apps/web/dist/cards/second/a2-p04-r2c3.webp`
`c4015db826ce2e059bfea765f3a81b26f9c3dd56d13bd391a0fe82a1b00a5ea9` `apps/web/dist/cards/second/a2-p04-r3c1.webp`
`87b48668e942dea6b08c2bd17bd0c0de7edf3c2f35ae3ec2d891de66fcab7672` `apps/web/dist/cards/second/a2-p04-r3c2.webp`
`9a1b0c9d9e1832b31cec0485027f58b25f1a69ac42934f2d3d471df52415e224` `apps/web/dist/cards/second/a2-p04-r3c3.webp`
`ec902364f3e0c1b796c92443f49e39f9a40fe01f2a26553f84c824553f9b1882` `apps/web/dist/cards/second/a2-p05-r1c1.webp`
`1097437a3ab41692ae401e96a23b6dac3fdcbd10c7d1e257f60801bd4cb4915d` `apps/web/dist/cards/second/a2-p05-r1c2.webp`
`bba393a494c70a7696d06679bd2e118cd464d255502a63edc2e57d19eb04de9b` `apps/web/dist/cards/second/a2-p05-r1c3.webp`
`c945b19c026251f91342c1fcb14f484d2c6582a3aa575ed5bdcef259157a26cc` `apps/web/dist/cards/second/a2-p05-r2c1.webp`
`dd6cf1d57a9e6fa61392c24b8b758447e257f409a9fd389e384a1e6c75938294` `apps/web/dist/cards/second/a2-p05-r2c2.webp`
`7212f510258d5b376ec48b07987bdad2bcb4f09f22226004e8ef21c4daeda995` `apps/web/dist/cards/second/a2-p05-r2c3.webp`
`0e6c22a1eef81ffdb124079c3555dfa7af94056ee253b74620d168d2cc2d1eb1` `apps/web/dist/cards/second/a2-p05-r3c1.webp`
`524d6f0f970f4eef6f1758eec0cf03ca36a1eeefc90aa8d14e83bdd6c86f8a41` `apps/web/dist/cards/second/a2-p05-r3c2.webp`
`5d2b02ca31745bf11472dc85c9fa00202de2e3638ca94b6a5e0a7ac1a1081d44` `apps/web/dist/cards/second/a2-p05-r3c3.webp`
`64dbf9c10a89da77822bd16e70ef22e224212785dfcb2f1c7cbeb6ef24c36323` `apps/web/dist/cards/second/a2-p06-r1c1.webp`
`cdc3d9b9a0e2086e2d20e1bca678d10800e72f0cbfc0c93289f6b05774e22757` `apps/web/dist/cards/second/a2-p06-r1c2.webp`
`ff26b9bfaf52c6f3cf4d4f8bef898d7ebea62233c650c87f4269480c09540787` `apps/web/dist/cards/second/a2-p06-r1c3.webp`
`89a7e7aff5c1464e105862897f4cdd742675be60b79b714afeb4bd7bcd509587` `apps/web/dist/cards/second/a2-p06-r2c1.webp`
`913845efb0c8730e0cbeef92445c5a453adb06138b44e44ec3a860af745cd650` `apps/web/dist/cards/second/a2-p06-r2c2.webp`
`2bc6effc4bc58db4c3333a7f0b1afb7133eea3c30d71cb97831f51e9921f7045` `apps/web/dist/cards/second/a2-p06-r2c3.webp`
`e955b5fb31063a665cafa4516574dfd8b8c3d7389314f06bcf3ffb4fc30f8de9` `apps/web/dist/cards/second/a2-p06-r3c1.webp`
`a49f70c761b165f9492cee79e070c7d2d0d95c4b2e5cf45aef866b7a7b624776` `apps/web/dist/cards/second/a2-p06-r3c2.webp`
`dc00fb2b567b5c46ce707181ccc462a644f26884ff1346be65b10796dbd0c52b` `apps/web/dist/cards/second/a2-p06-r3c3.webp`
`9ff9445468607a78a99fa83c4f7b73a11258db2fb0f82a33b0d190a619a69506` `apps/web/dist/cards/second/a2-p07-r1c1.webp`
`a51695e42f45b9711c9db6ee195da600aad9872439f51624d4c90867e6b53e9a` `apps/web/dist/cards/second/a2-p07-r1c2.webp`
`ff26b9bfaf52c6f3cf4d4f8bef898d7ebea62233c650c87f4269480c09540787` `apps/web/dist/cards/second/a2-p07-r1c3.webp`
`89a7e7aff5c1464e105862897f4cdd742675be60b79b714afeb4bd7bcd509587` `apps/web/dist/cards/second/a2-p07-r2c1.webp`
`913845efb0c8730e0cbeef92445c5a453adb06138b44e44ec3a860af745cd650` `apps/web/dist/cards/second/a2-p07-r2c2.webp`
`2bc6effc4bc58db4c3333a7f0b1afb7133eea3c30d71cb97831f51e9921f7045` `apps/web/dist/cards/second/a2-p07-r2c3.webp`
`e955b5fb31063a665cafa4516574dfd8b8c3d7389314f06bcf3ffb4fc30f8de9` `apps/web/dist/cards/second/a2-p07-r3c1.webp`
`a49f70c761b165f9492cee79e070c7d2d0d95c4b2e5cf45aef866b7a7b624776` `apps/web/dist/cards/second/a2-p07-r3c2.webp`
`fd061c216ecb3cbd1a12f961f1b22a674b29792d48689c9b6d50db41c15185e7` `apps/web/dist/cards/second/a2-p07-r3c3.webp`
`52b0eb65f4f6de0db760df183260b0cc95c9f061e08763e87f747f12ba9e29d2` `apps/web/dist/cards/second/a2-p08-r1c1.webp`
`7a4b94bef87b60ceb3813777f0a19c4fc9330016049d4d68aa579961ce1375a6` `apps/web/dist/cards/second/a2-p08-r1c2.webp`
`0ffb490e75861f54a9fc5f431c065faed1ef0c24c70cebc5f2e59be2056c7681` `apps/web/dist/cards/second/a2-p08-r1c3.webp`
`31fd02ff1c1473713b25ce45c36386f9e7839387d0774446cf18a7370724e3b6` `apps/web/dist/cards/second/a2-p08-r2c1.webp`
`3814e098a60206a6e27614688d74b98caac952f5fd4f3cfa729f006d90fc2331` `apps/web/dist/cards/second/a2-p08-r2c2.webp`
`ed3e291bd111008232f28408356584ebe1618a00adca704d924346ed92e33bc1` `apps/web/dist/cards/second/a2-p08-r2c3.webp`
`7950c8e0bf19dc1f6a3f5a285c4a541f3d3262478c965e3b8cdcdef01a944681` `apps/web/dist/cards/second/a2-p08-r3c1.webp`
`b962957b4727412192fe2b8d039b1041a705efacb8466825100c1bd94b0e1a16` `apps/web/dist/cards/second/a2-p08-r3c2.webp`
`cdf83725234f758c06d6b92743ea6cb5876eabb39511a925deed2814aba47097` `apps/web/dist/cards/second/a2-p08-r3c3.webp`
`e9e404ec4b01e98e02945ef9937c78ebe13591454f3b942a2980b978a3a29673` `apps/web/dist/cards/second/a2-p09-r1c1.webp`
`19bfdfc94223335fd8d8cc812f194a3f8f7a398fcac13b597ea60fc8bc6bd03f` `apps/web/dist/cards/second/a2-p09-r1c2.webp`
`e813204ea0e7495965eec4509841f781fe099dde374ab5dcee3d429a9206c05f` `apps/web/dist/cards/second/a2-p09-r1c3.webp`
`5cf83990b90e38bb22a3ad7363bc4e06f7d736980086436ff2b9f35d03ec64a3` `apps/web/dist/cards/second/a2-p09-r2c1.webp`
`0a4bf0a30e126a58a40092155287231b2d9c2f5f19c8b437e750b7f35a3c53ca` `apps/web/dist/cards/second/a2-p09-r2c2.webp`
`2860a2fcdae6d43747f54c5910586483d9e34b4b9249467376103e60ecfafbad` `apps/web/dist/cards/second/a2-p09-r2c3.webp`
`662baa827ef6cf188303478bde5d77532b3d49403b98265622dd8f64d039f3d9` `apps/web/dist/cards/second/a2-p09-r3c1.webp`
`eac53f0cab8fbbc8ad38ec46a1fa3d4a4549734f51b03798489341c1e552d4ee` `apps/web/dist/cards/second/a2-p09-r3c2.webp`
`ee39ec09b169fd8493c90f46405d738b9960d8da5040724936154e3181b1cb23` `apps/web/dist/cards/second/a2-p09-r3c3.webp`
`887e6187edef51cc42d6a70d671a2d9cf5d39f5f7e153ff50c04876ac3182a6d` `apps/web/dist/cards/second/a2-p10-r1c1.webp`
`43d0d9463c28b843a0333dd49d0b24ba894e27a0c369dc671a9cf4e452b8c526` `apps/web/dist/cards/second/a2-p10-r1c2.webp`
`79c991f5897fedfa19fc4b4db54116105423e3ee2d0ff9290cceeb70811a51d5` `apps/web/dist/cards/second/a2-p10-r1c3.webp`
`4e32574a41add190b7875e9d0fa1ec9e7b55fbc8f4d32669f88918f18edec597` `apps/web/dist/cards/second/a2-p10-r2c1.webp`
`94145b5a49838ce75289e4bb2c39e8df37e5f4b8dc885662f697d4e0ee0c56ba` `apps/web/dist/cards/second/a2-p10-r2c2.webp`
`3dfc47b691ebe96d0f238bad54172d15973d0edd29ed87e609ba6e89a4f248ec` `apps/web/dist/cards/second/a2-p10-r2c3.webp`
`6990ba9c0fee99f9c2db16633521474d51d7d53e0aaf0979247dc201a95e6517` `apps/web/dist/cards/second/a2-p10-r3c1.webp`
`5fe62bda1a717887b7fcf9af39733e39feea9821019cbb0b6208ec3bc7919cb4` `apps/web/dist/cards/second/a2-p10-r3c2.webp`
`c6cc6e2db58a7749bd8499867cf58db96217970fcd99f741b9e195d0f6718b08` `apps/web/dist/cards/second/a2-p10-r3c3.webp`
`680aaa7d95becaeca9f5d0fedf335a0e63edd664fce40bc00b8b385b37624b41` `apps/web/dist/cards/second/a2-p11-r1c1.webp`
`17859ea029bd6c1af7b307ebc645712cb494297669927ec7c0fc2ebccae3f289` `apps/web/dist/cards/second/a2-p11-r1c2.webp`
`469cf816f559cba6958317c119dd37c4743ea8860d2f1bfe3dabdc5d50db075c` `apps/web/dist/cards/second/a2-p11-r1c3.webp`
`10895273c828a052473517c33cb12c1e1e6c40d1a2c28afcec4da0757ca38479` `apps/web/dist/cards/second/a2-p11-r2c1.webp`
`bd152499661c739ca98edf2841b1f51b05278278e93b12901538967d716c3bea` `apps/web/dist/cards/second/a2-p11-r2c2.webp`
`58e5f6196a0566388042e697abcfb3de8d462a528e16d4f6b1fe2dde2aeab11c` `apps/web/dist/cards/second/a2-p11-r2c3.webp`
`6d86d15667e183c1c2d22ef66e4302d92003fd9874d72bdec6399d1369c7d83f` `apps/web/dist/cards/second/a2-p11-r3c1.webp`
`f88d50f74c92eb9bee42317d373042f948a745ecc6fc0c05bdbae5a1a44bb00c` `apps/web/dist/cards/second/a2-p11-r3c2.webp`
`ba5365785768fe5d27b2b2c169b38ddb59740bb5cae2ff91377fdf1662ffdcc7` `apps/web/dist/cards/second/a2-p11-r3c3.webp`
`247b260acd7c1804341944f8bf454905d6bad97b919be35a6d870b98f938534e` `apps/web/dist/cards/second/a2-p12-r1c1.webp`
`35e9b90fe6eef662113d35b62848a823c28a4e64b7c29837057a0e5b8b8e5ecd` `apps/web/dist/cards/second/a2-p12-r1c2.webp`
`c7ecd62b464b5fcb693a116cba4e2c29f3790cf0ebf885d2b28536cae51b95ec` `apps/web/dist/cards/second/a2-p12-r1c3.webp`
`37b957dbec6d52efa2794590981ec720eb910bc3bb78d24c25f9eedd5e55d0c8` `apps/web/dist/cards/second/a2-p12-r2c1.webp`
`b49d2f7827e64db1deb45a3550b9de36239c7ea3d6593366b164314c56ff11e2` `apps/web/dist/cards/second/a2-p12-r2c2.webp`
`fcbd682dcec94c9c237a559eb33cf8c8dd30623e230db3a112a21a0845636c11` `apps/web/dist/cards/second/a2-p12-r2c3.webp`
`20f45922412633741a68d79295bb0b043b0f768627988d92f6f3dddd23885c66` `apps/web/dist/cards/second/a2-p12-r3c1.webp`
`5843cbdff8131318daa8bdb1350b0fbc0b96ac865895839373a2a2b75a783727` `apps/web/dist/cards/second/a2-p12-r3c2.webp`
`e2ab1f304f671c57192ec4a961418df377d8db930f3a7f4e75043b515503ba95` `apps/web/dist/cards/second/a2-p12-r3c3.webp`
`b17eaec60dc42541575bd52c43c6bba969e9f56169315157755e2013d9112703` `apps/web/dist/cards/second/a2-p13-r1c1.webp`
`33058318c6c4722f76619ca9283915b5aed0ac2730724dea8db92b94fa4651db` `apps/web/dist/cards/second/a2-p13-r1c2.webp`
`a45fd13320d5976d17591b554e1ecd67004da48d10c780792cf5261c037d580b` `apps/web/dist/cards/second/a2-p13-r1c3.webp`
`53c0fce3383eae20ec48ed234641b09e30c5acbbe1af5d78d7091ca5203c453d` `apps/web/dist/cards/second/a2-p13-r2c1.webp`
`747f7404a062b344ff98525c86750a698fafd9990af883145f3eb98fe7ed3141` `apps/web/dist/cards/second/a2-p13-r2c2.webp`
`7ccb9ff224c72db7e39c110440517d7f49a4b41bc65cec03a72a3a90455f97b9` `apps/web/dist/cards/second/a2-p13-r2c3.webp`
`9baf566b1946bf02708efefab36088f4169d1d3434c9754d0d4247cdf049dd8d` `apps/web/dist/cards/second/a2-p13-r3c1.webp`
`c5068dc0257317dcc8d98ac889e01daa41ebeb40a6a8e94ee360ce8563f79511` `apps/web/dist/cards/second/a2-p13-r3c2.webp`
`58338953b1e1fde8cb0085778b2ebd84abf739d8085b52ecca0d881dfbe516be` `apps/web/dist/cards/second/a2-p13-r3c3.webp`
`25e2dfc5f17429c38f424860d1f1dc54c1bc8c8481cebdc86b7984f486a04abd` `apps/web/dist/cards/second/a2-p14-r1c1.webp`
`89fa04179ad9104918858fb784e4a629cdcfec83fa69d37a265a17d6287f2705` `apps/web/dist/cards/second/a2-p14-r1c2.webp`
`e6db521b8efa25eca0df61be2d5c5b5a8d91d98cc840d550b9f4336280807953` `apps/web/dist/cards/second/a2-p14-r1c3.webp`
`ed0779a9c03d1db3975f63d35b6d9531aab4b27563195c07c252da595e863374` `apps/web/dist/cards/second/a2-p14-r2c1.webp`
`97f5611f9ab13f5afbc8b7b3355b3fe6d5f6a1a988feb1d66786966d5c63bf59` `apps/web/dist/cards/second/a2-p14-r2c2.webp`
`ed36958369645be9e1735bcf6cfb78614a0e46c0c849602aaa69a24d4ba82217` `apps/web/dist/cards/second/a2-p14-r2c3.webp`
`a15c3ae9e78dd7c9c64fee7c2a3fb403d85cb724aa343f11274ef3dd6e28b791` `apps/web/dist/cards/second/a2-p14-r3c1.webp`
`10b13111b0905e5dbaca091cc942b24a41c9243cc202d939e831691f8fdc21e7` `apps/web/dist/cards/second/a2-p14-r3c2.webp`
`046ca47fa931b09a90c13c73acf02467ce438950773610b4fe0869171d888505` `apps/web/dist/cards/second/a2-p14-r3c3.webp`
`3d55c041a00848f6b4a49d6deafd51a207a46d3786123e9ead8975a351fd67fc` `apps/web/dist/cards/second/a2-p15-r1c1.webp`
`a246deaca26eb53148ea24920aea338a0b54bbf9ff83ac1b9da3a7c1e7e08a41` `apps/web/dist/cards/second/a2-p15-r1c2.webp`
`f647a50553001ecbb28e7f7866e97c81426e3db115888b9511342e566da33c6a` `apps/web/dist/cards/second/a2-p15-r1c3.webp`
`aa0ec86fcc36fcba8097eadf16b677a366c6b50b8812c1ed1726b7ce80b4ad6c` `apps/web/dist/cards/second/a2-p15-r2c1.webp`
`f6c7a49b3413b8fb4614ff5546dc2112ad94696e7efb3a71a93aa5ece5d6df5e` `apps/web/dist/cards/second/a2-p15-r2c2.webp`
`09e5ae8136f2ac251f4a1c05f514a196e354daed7f2be89fb05ea23eae3cd49b` `apps/web/dist/cards/second/a2-p15-r2c3.webp`
`763400842a678a516ecba18ff25aed3bcbb9c4ad3671de7e3d3aa55a45ca7b69` `apps/web/dist/cards/second/a2-p15-r3c1.webp`
`ee93b94aeebca4bdb94c78dd53c8f69680fc0749dc98d2f40e762fe0898191ed` `apps/web/dist/cards/second/a2-p15-r3c2.webp`
`f7debed107f67a628a3857df5f75b09967b392cb33a1728645800524169fe6fd` `apps/web/dist/cards/second/a2-p15-r3c3.webp`
`2cbe8fc55cf502b1a8da3ae2aa106c2afdf8841a1bb702f7b2e38a96569f6809` `apps/web/dist/cards/second/a2-p16-r1c1.webp`
`1b6a7c896b86530b2bb747e58412875adbea657ad0ab982bfc7a74ba76307cb5` `apps/web/dist/cards/second/a2-p16-r1c2.webp`
`7f93c1e2e8015b02ae64805d7a299fc9e9f67dce5a586888e4c012be1ae9ee64` `apps/web/dist/cards/second/a2-p16-r1c3.webp`
`d10e23304138f2342af8c781808a4817ed482a9473c294747444bb3aa7f50bb3` `apps/web/dist/cards/second/a2-p16-r2c1.webp`
`e2dca602f199bf8f385b6c106318e7bb8735e7a391546041e302b564466d6c73` `apps/web/dist/cards/second/a2-p16-r2c2.webp`
`1c55e75d5636b0fa1a3836d6ee5442559cce2435f2aa97beed1a894cc1f5ae83` `apps/web/dist/cards/second/a2-p16-r2c3.webp`
`5b927e4a70f66820f1918b6b29c9a1da298bfac8820e6d395e69e2ed33c3ab33` `apps/web/dist/cards/second/a2-p16-r3c1.webp`
`dc0e4794a371d8381c5d8fea348a6861c52c4fd2a2fb498acce8dc9f423462aa` `apps/web/dist/cards/second/a2-p16-r3c2.webp`
`3dced9be02140624de6da29b96f01fa38f33391e4b8c01f1f7ece401d1890d2d` `apps/web/dist/cards/second/a2-p16-r3c3.webp`
`d07eb27b4121b59a42c2a6fe5507f49d65bbc2bda673fe2cdd42bfaf03faf9e4` `apps/web/dist/cards/second/a2-p17-r1c1.webp`
`05675ff311cf1698feaf5911f4a706f4761cd11a54c34f71d024ba8ccb9b59c1` `apps/web/dist/cards/second/a2-p17-r1c2.webp`
`89988be772797ac715978377446583675878cc95201c09750be514f1ec2330e4` `apps/web/dist/cards/second/a2-p17-r1c3.webp`
`95c0c871f4a6800c692c1eea911ea2d53036c2d4edf286b491611b6b653a41da` `apps/web/dist/cards/second/a2-p17-r2c1.webp`
`5f48092b741e0a1602b06cd25153056f58ef944cf598198a1660ba9f38b2998c` `apps/web/dist/cards/second/a2-p17-r2c2.webp`
`df2c3d1d1641c2f88ecd4ccf5d7944ecca6bbc1b565c0cfaca815ebc2919c7df` `apps/web/dist/cards/second/a2-p17-r2c3.webp`
`c024617e2d051e6f0345cdb0caf47c0480ebe0c03008770995a0148ef7d3260f` `apps/web/dist/cards/second/a2-p17-r3c1.webp`
`4ca2e5b6ab190bd4fc3cc963e1b8cb3782d27bc00cc43e818601e9c895569cf3` `apps/web/dist/cards/second/a2-p17-r3c2.webp`
`6babd631f5f64d5b57038e51c027f03787d64c7373c8f860d2dc20a03506ad81` `apps/web/dist/cards/second/a2-p17-r3c3.webp`
`6e4db32a0e291ae3668771d3645ecb2c3ad9b7d89a85eb55c32524b6ce12845c` `apps/web/dist/cards/second/a2-p18-r1c1.webp`
`58fa58fb388817a5cc161d76078b1148f7b0059ff15aae0827f24b6bcd1b5ccf` `apps/web/dist/cards/second/a2-p18-r1c2.webp`
`3a757ff7555f37a63ff9211edcd467ab145e7ac44e2ac25575a13ba637355211` `apps/web/dist/cards/second/a2-p18-r1c3.webp`
`fa5208ccc9230ed5480df92c4d7ff42004918664c3be7f2779ac0eef76bdb155` `apps/web/dist/cards/second/a2-p18-r2c1.webp`
`2cfa9643308b4e2dff5fe6b5a8924b000584c83dfb9190ca08d280ee1159a1f7` `apps/web/dist/cards/second/a2-p18-r2c2.webp`
`398b5e1685adc1766a8a717f480b373a68f5799185d374523e65eaf1bdcb5c04` `apps/web/dist/cards/second/a2-p18-r2c3.webp`
`dd461582cd88cc400348c7189886772f8059b7b3be77e2a67c9643f11d9e05cf` `apps/web/dist/cards/second/a2-p18-r3c1.webp`
`27cbe6d006879d1ebce0061326e693bfc552232f69bb0b8fb79d471a35583131` `apps/web/dist/cards/second/a2-p18-r3c2.webp`
`b53cb03a2a03213b419c1a7788581b6a94b9039cd2012f8af65b43e355a7abe6` `apps/web/dist/cards/second/a2-p18-r3c3.webp`
`e1662916f2ebd1a9b72091468d8d099e3a832b958485f899243ec91921d1b5a8` `apps/web/dist/cards/second/a2-p19-r1c1.webp`
`a2a05cb0ad1ae48f15c37fc26dae845c18fc7c0b67711b7e9b374fd1f5a54426` `apps/web/dist/cards/second/a2-p19-r1c2.webp`
`c74fc5158e86b63cdc9ce3d748fd55d46fc448108abd479d4292af9fae11daca` `apps/web/dist/cards/second/a2-p19-r1c3.webp`
`322e88d6dd0107c2630b4e64e5d0013912f3e2acd56c4f8aad2b863ec9634e1c` `apps/web/dist/cards/second/a2-p19-r2c1.webp`
`41f0d723c6d9ea11bd698023ff33e635198ff3554694aabcb5d79204fb1c0c55` `apps/web/dist/cards/second/a2-p19-r2c2.webp`
`73292fb95285a5c56978edf56fafa7616e1faa92de9905a296181284857a3a41` `apps/web/dist/cards/second/a2-p19-r2c3.webp`
`64153d35627c4836d1fff82ba71a812a87e2094bb2f54c575b6fef13bc18aeab` `apps/web/dist/cards/second/a2-p19-r3c1.webp`
`6f85af6c99b7997c3c704673cfed3459e815b9f644ca0cbb0b8aba504bfc5ac1` `apps/web/dist/cards/second/a2-p19-r3c2.webp`
`eea23c6c34cb6006ae5f343bfaaba1d333e14da678989cd054861c4501017bd8` `apps/web/dist/cards/second/a2-p19-r3c3.webp`
`97f0c1e6ec75b73669161d1b91c90ce6b1a85f209339dcbd3b566cd37871b5bc` `apps/web/dist/cards/second/a2-p20-r1c1.webp`
`3cb735f89e36073f2bf3f1f901eb26b84898862cddac8b7897a62a701ef153f1` `apps/web/dist/cards/second/a2-p20-r1c2.webp`
`1c6bead8f60eb155c004380f67dd76abce414d0f280203484fd7e1f67807ac36` `apps/web/dist/cards/second/a2-p20-r1c3.webp`
`ea6d51d4d0ada7c3a227f257d6200767ace5ff208e9ba71166dba484d09bdc80` `apps/web/dist/cards/second/a2-p20-r2c1.webp`
`505b9cbf0f32879a2956ebe5a5430b509a714c8109809f142f199db227b3164a` `apps/web/dist/cards/second/a2-p20-r2c2.webp`
`862773b54b7d60473b4f68cb9cbb40de48353e79d38e0ce34db202c776b56b3a` `apps/web/dist/cards/second/a2-p20-r2c3.webp`
`6526fc038e04f48b2c19a3643d60e1dcc2e29b7294675e982179c085bc1e4c6b` `apps/web/dist/cards/second/a2-p20-r3c1.webp`
`d0f4ab6c1916e2f5c83ed0d4324fed24ea8490ea536c58187bb2c4ae4b7a46b2` `apps/web/dist/cards/second/a2-p20-r3c2.webp`
`e9bba459a880827476180ea87887247aa1f5b3f3de4c484cb384bfd40af96738` `apps/web/dist/cards/second/a2-p20-r3c3.webp`
`6dd8c2359edcf76efc0e6d36361f3d495fde69889a1290e75e3c094084edc728` `apps/web/dist/cards/second/a2-p21-r1c1.webp`
`a6cdecd0f9706ee7be30c7af9ce4b94be223f2d5edc88b72d9533adaca886949` `apps/web/dist/cards/second/a2-p21-r1c2.webp`
`d616c244f0b82fe0172e750610f5c5af7af8d6e51e66af88f0bdc4ef45976100` `apps/web/dist/cards/second/a2-p21-r1c3.webp`
`9b03104308fab965a04eda8e2b37bdcfbe39ab4c682acd4db6f6322515a8d6f4` `apps/web/dist/cards/second/a2-p21-r2c1.webp`
`352f149c64aa384ad2ec300410f404cdd83571c1e0316311d842b1ccebeff1a9` `apps/web/dist/cards/second/a2-p21-r2c2.webp`
`6a5e03cbcfb83dbd505a34623cf63f1fb02907502e6efad3c373c351b0fb637c` `apps/web/dist/cards/second/a2-p21-r2c3.webp`
`26eeab63e1375d029e243f3526a3c1aa2571fe9e2ac992e159278d8e5196ca0f` `apps/web/dist/cards/second/a2-p21-r3c1.webp`
`4450cbc7e5823f86a83317863a6aa464d35669ebeb5fea635f8cb7d2f2ab189c` `apps/web/dist/cards/second/a2-p21-r3c2.webp`
`9303eb81d870a5f046d884946e4c2aca2f8e5262ca4eb75aa32b5bfc99590f21` `apps/web/dist/cards/second/a2-p21-r3c3.webp`
`2814dbf3e22686d41c7c8897cb1a0dd0ee64a4ff0d5df9bf0d7c52cd930bc316` `apps/web/dist/cards/second/a2-p22-r1c1.webp`
`4a62ca5786bb1524210f885c7ca4087a384eac53a82a39f42c1589e025e877c7` `apps/web/dist/cards/second/a2-p22-r1c2.webp`
`5e848f51e973a8279ca33a252910af83c7f04466cb3e9a22c38772665a8ca5f3` `apps/web/dist/cards/second/a2-p22-r1c3.webp`
`95d655f6c35aa05f9275ff15814c080ac91a4f9c1650cd41c592d5489c63d597` `apps/web/dist/cards/second/a2-p22-r2c1.webp`
`8c9667a1e7b80d4fb266d7b33a37ae8faec325eff826854304d77d5f2ea12b24` `apps/web/dist/cards/second/a2-p22-r2c2.webp`
`a3337047aa7ce63607501eecb79cb37e57101e7cfcf8ea61648a73930e01ba14` `apps/web/dist/cards/second/a2-p22-r2c3.webp`
`65235c63066ffb762d166646995f2798aee4ce49ba2475d1415da80dfa6ad0d5` `apps/web/dist/cards/second/a2-p22-r3c1.webp`
`d0124f8e235e3de02ae1d3ca132ace2ff5bf91726e3dca2be1e484bac628b7cb` `apps/web/dist/cards/second/a2-p22-r3c2.webp`
`076028a5e05b31c462315fbd8da90c16951c6020e8893dd3d9816595a12ee0a6` `apps/web/dist/cards/second/a2-p22-r3c3.webp`
`7fa63d353f2912b1c36613b3fdc6f5359654d35452940703a912972269fcf8ef` `apps/web/dist/cards/second/a2-p23-r1c1.webp`
`5b3edd75ac5829cf9ea8a31b076709d9adc10e899e452cfc65b194b13a60ba22` `apps/web/dist/cards/second/a2-p23-r1c2.webp`
`fa6647b9945e8b55da9a6cc49bcbe1e87a35d6cdc72c34b8834e4b34226f6e41` `apps/web/dist/cards/second/a2-p23-r1c3.webp`
`f8a965a4c4ed47b44a8fe8931a9cd948f4320b2d52d2a52ec5385ca21da35ec0` `apps/web/dist/cards/second/a2-p23-r2c1.webp`
`eef5976f045728759a24c4d3b65e3e32cd387270d2b81376d271be688dbb6719` `apps/web/dist/cards/second/a2-p23-r2c2.webp`
`398ae3ebba75ddf506c05c4e2d160af06a28ef78b81982a337af77b0baac82ae` `apps/web/dist/cards/second/a2-p23-r2c3.webp`
`6e137f15b32b115caa30cf8e8ea2f418dbb5e4945eafe79e1683c55ded5cee52` `apps/web/dist/cards/second/a2-p23-r3c1.webp`
`4b054c1e4d7f19f72158f6ad63724e867ac3d7d7b4bd19a6698e482e95db465e` `apps/web/dist/cards/second/a2-p23-r3c2.webp`
`458889f1efb5cd6c2c5e465c95adbac0d3c92a313c231ce5f9985dfc59185bde` `apps/web/dist/cards/second/a2-p23-r3c3.webp`
`df4fe81cfe00f947b3661ffead633379407f7bb532512a88c1b29e208a5790dc` `apps/web/dist/cards/second/a2-p24-r1c1.webp`
`b185bf3cdd994829f241e219c6e041dd4c9405b73fe0d568de0d1a590c4d4403` `apps/web/dist/cards/second/a2-p24-r1c2.webp`
`8443ea1b08fb978de3252b54e376cc46251025955bca24916c9fef40e0f4c142` `apps/web/dist/cards/second/a2-p24-r1c3.webp`
`cad0a5d13b805780ec995a4274c161a4d2dc4136aec69192f6ceedb9dc618aea` `apps/web/dist/cards/second/a2-p24-r2c1.webp`
`3ccada21e349e2c99504125fc64696e607051be291a766dac695a85e897abf48` `apps/web/dist/cards/second/a2-p24-r2c2.webp`
`ab330f0eae5a19d1b23a1562b80a74cbd5c93f74e3882721995069899348ca30` `apps/web/dist/cards/second/a2-p24-r2c3.webp`
`27b3356382d164dae5800299db3c488847f835fa5d9f3c51b8ad071388012e4b` `apps/web/dist/cards/second/a2-p24-r3c1.webp`
`d41741e3b46cd4eb302e3d5b4694819ecbb3c3538dbfa4a35f92b5bb322a3ef9` `apps/web/dist/cards/second/a2-p24-r3c2.webp`
`cdd351f63d470f018da4b97aca01e1a735b827c4e8c636c09f382042af84bbdb` `apps/web/dist/cards/second/a2-p24-r3c3.webp`
`63a985449422c9c437f7d6a88d7ee07fe8eba4347b8235caf83063fe19ef8b6c` `apps/web/dist/cards/second/a2-p25-r1c1.webp`
`4e14256c874ff26d371df24926e1c0951b9daf21e281f33cc1efd2866eb231c9` `apps/web/dist/cards/second/a2-p25-r1c2.webp`
`92b4eaf87dc2a454f179dd233df6d99a4a021f9a6856de4b7144c1c0ecb3f780` `apps/web/dist/cards/second/a2-p25-r1c3.webp`
`48a905ff47a026fbd8e092aa79fa2137cc69a6ac68609515436bb2ae80243b75` `apps/web/dist/cards/second/a2-p25-r2c1.webp`
`bb3dbe29ebfd22d8b839dde50e9a8e424f9c2dc7e48d1f920b882b8635e2031b` `apps/web/dist/cards/second/c2-p01-r1c1.webp`
`8b69e9e75145840d0746ec97d8b0f8aaff9f082864e38ad893238f133fee415f` `apps/web/dist/cards/second/c2-p01-r1c2.webp`
`24587513789d787f8d8a43d003921ad2b5dd9252fe4af06743bae8e2d0f1158f` `apps/web/dist/cards/second/c2-p01-r2c1.webp`
`3756dcd167093590d7cf34d5fe6d2a5200e974891cd2a47153e4f0f54aec6b35` `apps/web/dist/cards/second/c2-p01-r2c2.webp`
`69684d029b612a212fe5f03b57f20b01463d44368c357b9abb66151c84dc0e00` `apps/web/dist/cards/second/c2-p02-r1c1.webp`
`9070a7ae06dde1dc9eadd673fe2e92eaae614f567bb9c4bfb7cc54cb09995f52` `apps/web/dist/cards/second/c2-p02-r1c2.webp`
`156ea160d22dfddc38e2e2ea78f7c6abe355202ebccf5ea3841565b09eac4ffb` `apps/web/dist/cards/second/c2-p02-r2c1.webp`
`97173a423cc37d88bc2bb797ab8b269770b85bffba3971863b2069ff3d07c493` `apps/web/dist/cards/second/c2-p02-r2c2.webp`
`afd41f41a765e28b285d3b1740e211f9c66a96ed89906d013a2f38864868bb0b` `apps/web/dist/cards/second/c2-p03-r1c1.webp`
`a4614c5bd749de7f9312a7bcd68183b2b3f279749c79a669423d0018067ab4f5` `apps/web/dist/cards/second/c2-p03-r1c2.webp`
`b51a1e01e01fb655d3de26a8001f1114104b957e35960afd9ce105f8beea5928` `apps/web/dist/cards/second/c2-p03-r2c1.webp`
`c71c336d31828c96aeae6406b6bfa9bca84f74acb944092e8244f2ded04b3e26` `apps/web/dist/cards/second/c2-p03-r2c2.webp`
`540dfb1bf250f8afd0c0b86ef02bbbd86412476670327fdb1720f024c123744a` `apps/web/dist/cards/second/c2-p04-r1c1.webp`
`8ad514d5cec6078fcf6a0b866e5275377473d497205d00774ce7ca7de4898a27` `apps/web/dist/cards/second/c2-p04-r1c2.webp`
`d58e0a866a50326d32d93b0db247d55460127a8b89ad6eac73f85c4615a8e25d` `apps/web/dist/cards/second/c2-p04-r2c1.webp`
`e32bc17de1ec224fb5ee8306c7e346aa08b1c538d26967849af29476af0a86ac` `apps/web/dist/cards/second/c2-p04-r2c2.webp`
`dc4dda1a3b8693191add027070957f5c1e1a752821bff7a7e10e930e9065127d` `apps/web/dist/cards/second/c2-p05-r1c1.webp`
`5e86cf0291c8d5975d43fc752ae04b264743dbbf1f2ca6a459d29cea8467eaf9` `apps/web/dist/cards/second/c2-p05-r1c2.webp`
`13ff2d52ad449a1de7ac82abc2042f37ea86a224b69a0390c68b89496ac626ee` `apps/web/dist/cards/second/c2-p05-r2c1.webp`
`8d6f7482b5066baac9ecd224f27ac150b583ea6ac0a047912c21f819b3a7180f` `apps/web/dist/cards/second/c2-p05-r2c2.webp`
`4a1268071c157785754b903e1ca0146d446cf3cb0d83ff700d4544a49da53397` `apps/web/dist/cards/second/c2-p06-r1c1.webp`
`a30b15293e9da4535d65dcb437c758364c26179bed0d8fea73b26b41dae6eae9` `apps/web/dist/cards/second/c2-p06-r1c2.webp`
`4aa1fcf7b09c2ff53fd8df025f55c61911ccf417aec87e2cb91b3033743344ae` `apps/web/dist/cards/second/c2-p06-r2c1.webp`
`1bbb79659a23aead50d7f007d316bc3f528c13500f04937a79ea082ab608ba44` `apps/web/dist/cards/second/c2-p06-r2c2.webp`
`347cbc2bd1e7ed07ae45ef66827dc35bfd763a4a6566270759773700f0cfe679` `apps/web/dist/cards/second/c2-p07-r1c1.webp`
`fb3bbbe689a8eb76952bdcbce75afd07797dacdaf72c697027b4e050e68a6448` `apps/web/dist/cards/second/c2-p07-r1c2.webp`
`bc4f827e76cd38120c8386909e32ab72d5ced6fcf581e7ac52a25cbdf4485a6d` `apps/web/dist/cards/second/manifest.json`
`9094030f6010fffdcb6ceed74d0f61cc1e50eca5e64bd24443ff492def1f44dd` `apps/web/dist/index.html`

### apps/worker/dist

`92b9199f2ca8b6504f5315cfd4f797f932e421c70803b113b6e17ec332421a64` `apps/worker/dist/README.md`
`14deac8e9b3a08e90de22e5aa11648bb331c62ac1c26f4d5fb4d1c9ca880fad7` `apps/worker/dist/index.js`
`104802698116209f873f459e0742c12f50a554dbcf28e72e756ba8dcbff241bb` `apps/worker/dist/index.js.map`
