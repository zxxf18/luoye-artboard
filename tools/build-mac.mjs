import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from './bundle.mjs';
import './build.mjs';
import { version, releaseRoot } from './release-paths.mjs';
if (process.platform !== 'darwin') throw new Error('Mac application must be built on macOS.');
const app = path.join(releaseRoot, '落叶画板.app');
await mkdir(path.join(app, 'Contents/MacOS'), { recursive:true });
await mkdir(path.join(app, 'Contents/Resources'), { recursive:true });
await mkdir(path.join(root, 'build/swift-cache'), { recursive:true });
await rm(path.join(app, 'Contents/Resources/site'), { recursive:true, force:true });
await cp(path.join(root, 'dist'), path.join(app, 'Contents/Resources/site'), { recursive:true });
for(const name of ['index.html','app.js','playroom.css','assets/catalog.json']){
 const actual=await readFile(path.join(app,'Contents/Resources/site',name));
 const expected=await readFile(path.join(root,'dist',name));
 if(!actual.equals(expected))throw new Error('Mac 资源复制不完整：'+name);
}
await writeFile(path.join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleName</key><string>落叶画板</string><key>CFBundleDisplayName</key><string>落叶画板</string><key>CFBundleIdentifier</key><string>local.luoye.studio</string><key>CFBundleExecutable</key><string>LUOYEStudio</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${version}</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>CFBundleIconFile</key><string>AppIcon</string><key>NSHighResolutionCapable</key><true/></dict></plist>`);
await cp(path.join(root,'public/branding/AppIcon.icns'), path.join(app,'Contents/Resources/AppIcon.icns'));
const result = spawnSync('xcrun', ['swiftc', '-swift-version', '6', '-target', 'arm64-apple-macos13.0', '-module-cache-path', path.join(root,'build/swift-cache'), '-framework','AppKit','-framework','WebKit','-framework','AVFoundation','-framework','AudioToolbox', path.join(root,'native/macos/Music.swift'), path.join(root,'native/macos/Archive.swift'), path.join(root,'native/macos/Main.swift'), '-o',path.join(app,'Contents/MacOS/LUOYEStudio')], { stdio:'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Mac application built: ${app}`);
