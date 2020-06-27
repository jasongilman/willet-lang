#!/usr/bin/env bash

npm install

if [ $? != 0 ]; then
  printf "NPM install failed"
  exit 1
fi

npm link
if [ $? != 0 ]; then
  printf "link failed"
  exit 1
fi

npm link willet
if [ $? != 0 ]; then
  printf "link willet failed"
  exit 1
fi

bin/build.sh
if [ $? != 0 ]; then
  printf "build failed"
  exit 1
fi
