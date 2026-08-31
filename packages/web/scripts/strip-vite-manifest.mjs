// Vite manifestはbudget検査が初期chunkを辿るための内部ファイルで、配信物ではない。
// dist/をそのままassetsとして公開するので、検査が読み終えたら消してから配る。
// 検査を伴わないbuild:artifactからも呼ぶため、無くても失敗しない。
import { rmSync } from 'node:fs';

rmSync(new URL('../dist/.vite/manifest.json', import.meta.url), { force: true });
