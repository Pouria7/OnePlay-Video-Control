import { build } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

async function runBuild() {
  console.log('🚀 Starting OnePlay - Video Control extension build...');

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  console.log('📦 Building popup...');
  await build({
    configFile: false,
    base: './',
    root: path.resolve(rootDir, 'src/popup'),
    publicDir: false,
    build: {
      outDir: path.resolve(distDir, 'popup'),
      emptyOutDir: false,
      target: 'es2022',
      minify: false,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/popup/popup.html'),
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    }
  });

  const nestedPopupHtml = path.resolve(distDir, 'popup/src/popup/popup.html');
  const targetPopupHtml = path.resolve(distDir, 'popup/popup.html');
  if (fs.existsSync(nestedPopupHtml) && !fs.existsSync(targetPopupHtml)) {
    fs.renameSync(nestedPopupHtml, targetPopupHtml);
    fs.rmSync(path.resolve(distDir, 'popup/src'), { recursive: true, force: true });
  }

  console.log('📦 Building options dashboard...');
  await build({
    configFile: false,
    base: './',
    root: path.resolve(rootDir, 'src/options'),
    publicDir: false,
    build: {
      outDir: path.resolve(distDir, 'options'),
      emptyOutDir: false,
      target: 'es2022',
      minify: false,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/options/options.html'),
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    }
  });

  const nestedOptionsHtml = path.resolve(distDir, 'options/src/options/options.html');
  const targetOptionsHtml = path.resolve(distDir, 'options/options.html');
  if (fs.existsSync(nestedOptionsHtml) && !fs.existsSync(targetOptionsHtml)) {
    fs.renameSync(nestedOptionsHtml, targetOptionsHtml);
    fs.rmSync(path.resolve(distDir, 'options/src'), { recursive: true, force: true });
  }

  console.log('📦 Building content script...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: path.resolve(distDir, 'content'),
      emptyOutDir: false,
      target: 'es2022',
      minify: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content/index.ts'),
        name: 'UFVC_Content',
        formats: ['iife'],
        fileName: () => 'index.js'
      }
    }
  });

  console.log('📦 Building background service worker...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: path.resolve(distDir, 'background'),
      emptyOutDir: false,
      target: 'es2022',
      minify: false,
      lib: {
        entry: path.resolve(rootDir, 'src/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js'
      }
    }
  });

  console.log('📋 Copying manifest.json and icons to dist...');

  const rootManifestPath = path.resolve(rootDir, 'manifest.json');
  const publicManifestPath = path.resolve(rootDir, 'public/manifest.json');

  if (!fs.existsSync(rootManifestPath) && fs.existsSync(publicManifestPath)) {
    fs.copyFileSync(publicManifestPath, rootManifestPath);
  }

  if (!fs.existsSync(rootManifestPath)) {
    throw new Error('manifest.json not found in project root!');
  }

  const pkgJson = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
  const manifestContent = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
  manifestContent.version = pkgJson.version || manifestContent.version;

  const serializedManifest = JSON.stringify(manifestContent, null, 2);

  fs.writeFileSync(path.resolve(distDir, 'manifest.json'), serializedManifest);

  fs.mkdirSync(path.dirname(publicManifestPath), { recursive: true });
  fs.writeFileSync(publicManifestPath, serializedManifest);

  fs.writeFileSync(rootManifestPath, serializedManifest);

  const iconsDistDir = path.resolve(distDir, 'icons');
  if (!fs.existsSync(iconsDistDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
  }

  const iconsSrcDir = path.resolve(rootDir, 'public/icons');
  if (fs.existsSync(iconsSrcDir)) {
    const files = fs.readdirSync(iconsSrcDir);
    for (const file of files) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDistDir, file));
    }
  }

  console.log('✨ Build complete! Extension ready in: dist/');
}

runBuild().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});