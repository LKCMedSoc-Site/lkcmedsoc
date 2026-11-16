#!/bin/sh
# Copies the editor next to node_modules with its CDN imports pointed at the local packages, so it can run in Node (jsdom).
cd "$(dirname "$0")" && sed 's#https://esm.sh/\(@tiptap/[a-z-]*\)@2.10.3#\1#' ../../records/visual-editor.js > ve.mjs
