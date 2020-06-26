#!/usr/bin/env bash
# Tests that the published version of willet can be installed and used.

cd ..
rm -rf temp-willet
mkdir temp-willet
cd temp-willet
npm init -y
npm install willet

if [[ $? != 0 ]]; then
  printf "Install failed"
  exit 1
fi

echo 'console.log("Hello Willet!")' > index.wlt
willet-compile index.wlt .

if [[ $? != 0 ]]; then
  printf "Compile failed"
  exit 1
fi

node index.js > captured_output.txt

if [[ $? != 0 ]]; then
  printf "Run of compiled code failed"
  exit 1
fi

captured_output=$(cat captured_output.txt)

if [[ $captured_output != "Hello Willet!" ]]; then
  printf "Unexpected output"
  exit 1
fi

cd ..
rm -rf temp-willet
