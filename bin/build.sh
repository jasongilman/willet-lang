#!/usr/bin/env bash

echo "Building Willet"

CUR_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$CUR_DIR/.."

mkdir -p $ROOT_DIR/dist

$ROOT_DIR/bin/compile.js --skipcore $ROOT_DIR/lib/willet-core.wlt $ROOT_DIR/dist/
if [ $? != 0 ]; then
  printf "Failed to compile willet source"
  exit 1
fi

mkdir -p $ROOT_DIR/dist-tests

$ROOT_DIR/bin/compile.js $ROOT_DIR/wlt-tests $ROOT_DIR/dist-tests
if [ $? != 0 ]; then
  printf "Failed to compile willet tests code"
  exit 1
fi

$ROOT_DIR/bin/generate_syntax_diagram.js
if [ $? != 0 ]; then
  printf "Failed to generate syntax diagram"
fi

echo "Complete"
