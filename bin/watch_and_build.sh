#!/usr/bin/env bash

{ find . -name "*.wlt" ; find lib -name "*.js" ; ls *.js ; } | entr bin/build.sh
