#!/usr/bin/env bash

find . -name "*.wlt" | entr bin/build.sh
