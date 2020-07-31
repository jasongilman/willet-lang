#!/usr/bin/env bash

npm publish
if [ $? != 0 ]; then
  printf "NPM publish failed"
  exit 1
fi

node bin/increment_version.js
if [ $? != 0 ]; then
  printf "Increment version failed"
  exit 1
fi

npm install
if [ $? != 0 ]; then
  printf "npm install failed"
  exit 1
fi

git add package.json package-lock.json
if [ $? != 0 ]; then
  printf "git add failed"
  exit 1
fi

git commit -m "Incrementing version"
if [ $? != 0 ]; then
  printf "git commit failed"
  exit 1
fi

git push
if [ $? != 0 ]; then
  printf "git push failed"
  exit 1
fi
