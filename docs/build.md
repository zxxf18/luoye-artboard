# Build and release

The editor is tested with Node.js 22 or later. Run `npm test` before building a desktop package. macOS packaging uses the local Swift host; Windows packaging uses the .NET host and WebView2.

The experimental fractal renderer remains implemented for compatibility and internal access, but its controls are hidden from the public editor toolbar.
