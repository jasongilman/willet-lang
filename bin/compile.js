#!/usr/bin/env node

const _ = require('lodash');
const compiler = require('../compiler');
const fs = require('fs');
const path = require('path');
const program = require('commander');

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const readFilesFromDir = (dir) =>
  _(fs.readdirSync(dir))
    .map((f) => path.join(dir, f))
    .flatMap((f) => {
      if (fs.lstatSync(f).isDirectory()) {
        return readFilesFromDir(f);
      }
      return [f];
    })
    .value();

let src;
let target;
program
  .version('0.0.1')
  .arguments('<source> <targetDir>')
  .action((source, targetDir) => {
    src = source;
    target = targetDir;
  });

program.parse(process.argv);

if (typeof src === 'undefined') {
  fail('no source given');
}
if (typeof target === 'undefined') {
  fail('no target given');
}

if (!fs.existsSync(src)) {
  fail(`source [${src}] does not exist`);
}

if (fs.existsSync(target)) {
  if (!fs.lstatSync(target).isDirectory()) {
    fail(`target [${target}] is not a directory`);
  }
}
else {
  fail(`target [${target}] does not exist`);
}

let filesToCompile;

if (fs.lstatSync(src).isDirectory()) {
  const files = readFilesFromDir(src);
  filesToCompile = _.filter(files, (f) => f.endsWith('.wlt'));
}
else {
  filesToCompile = [src];
}

for (let i = 0; i < filesToCompile.length; i += 1) {
  const file = filesToCompile[i];
  const targetFile = path.join(target, path.relative(src, file).replace(/\.wlt$/, '.js'));
  console.log(`Compiling ${file} to ${targetFile}`);
  const contents = fs.readFileSync(file).toString();
  const jsContents = compiler.compile(contents);
  fs.writeFileSync(targetFile, jsContents);
}
