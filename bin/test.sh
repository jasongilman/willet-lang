#!/usr/bin/env bash

CUR_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

node_modules/.bin/eslint .

if [ $? != 0 ]; then
  printf "Lint failure"
  exit 1
fi

mkdir -p $CUR_DIR/../dist-tests

node willet-compile.js $CUR_DIR/../wlt-tests $CUR_DIR/../dist-tests

if [ $? != 0 ]; then
  printf "Failed to compile tests"
  exit 1
fi

node_modules/.bin/mocha --timeout 0 -b tests/ dist-tests/
