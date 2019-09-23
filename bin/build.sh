#!/usr/bin/env bash

echo "Building Willet"

mkdir -p dist

bin/compile.js lib dist
if [ $? != 0 ]; then
  printf "Failed to compile willet source"
  exit 1
fi

echo "Complete"
