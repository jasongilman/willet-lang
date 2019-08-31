#!/usr/bin/env bash

echo "Building Willet"

mkdir -p dist

node_modules/.bin/pegjs -o dist/willet-parser.js parser/willet-grammar.pegjs
if [ $? != 0 ]; then
  printf "Failed to create parser"
  exit 1
fi

echo "Complete"
