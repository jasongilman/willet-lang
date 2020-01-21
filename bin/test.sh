#!/usr/bin/env bash

CUR_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# TODO add linting

mkdir -p $CUR_DIR/../dist-tests

node bin/compile.js $CUR_DIR/../wlt-tests $CUR_DIR/../dist-tests

if [ $? != 0 ]; then
  printf "Failed to compile tests"
  exit 1
fi

# TODO temporary only testing willet code.
node_modules/.bin/mocha --timeout 0 -b tests/ dist-tests/
# node_modules/.bin/mocha --timeout 0 -b dist-tests/
