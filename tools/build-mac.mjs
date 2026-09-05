import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from './bundle.mjs';
import './build.mjs';
if (process.platform !== 'darwin') throw new Error('Mac application must be built on macOS.');
const app = path.join(root, 'build', '落叶画板.app');
await mkdir(path.join(app, 'Contents/MacOS'), { recursive:true });
await mkdir(path.join(app, 'Contents/Resources'), { recursive:true });
await mkdir(path.join(root, 'build/swift-cache'), { recursive:true });
await rm(path.join(app, 'Contents/Resources/site'), { recursive:true, force:true });
await cp(path.join(root, 'dist'), path.join(app, 'Contents/Resources/site'), { recursive:true });
await writeFile(path.join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleName</key><string>落叶画板</string><key>CFBundleDisplayName</key><string>落叶画板</string><key>CFBundleIdentifier</key><string>local.jshw.studio</string><key>CFBundleExecutable</key><string>JSHWStudio</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.5.0</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>CFBundleIconFile</key><string>AppIcon</string><key>NSHighResolutionCapable</key><true/></dict></plist>`);
await cp(path.join(root,'public/branding/AppIcon.icns'), path.join(app,'Contents/Resources/AppIcon.icns'));
const result = spawnSync('xcrun', ['swiftc', '-swift-version', '6', '-target', 'arm64-apple-macos13.0', '-module-cache-path', path.join(root,'build/swift-cache'), '-framework','AppKit','-framework','WebKit','-framework','AVFoundation','-framework','AudioToolbox', path.join(root,'native/macos/Music.swift'), path.join(root,'native/macos/Archive.swift'), path.join(root,'native/macos/Main.swift'), '-o',path.join(app,'Contents/MacOS/JSHWStudio')], { stdio:'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Mac application built: ${app}`);
