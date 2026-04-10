package web

import "embed"

//go:embed index.html style.css script.js favicon.svg
var Assets embed.FS
