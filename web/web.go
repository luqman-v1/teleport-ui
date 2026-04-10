package web

import "embed"

//go:embed index.html style.css script.js favicon.svg manifest.json sw.js icons
var Assets embed.FS
