#!/usr/bin/env node

const _ = require('lodash');
const compiler = require('./lib/compiler');
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
let skipCore = false;

program
  .version('0.0.1')
  .arguments('<source> <targetDir>')
  .option('-c, --skipcore', 'Skip including Willet Core')
  .action((source, targetDir, cmdObj) => {
    src = source;
    target = targetDir;
    skipCore = !!cmdObj.skipcore;
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
    fail(`Target [${target}] is not a directory`);
  }
}
else {
  fail(`Target directory [${target}] does not exist`);
}

let filesToCompile;

if (fs.lstatSync(src).isDirectory()) {
  const files = readFilesFromDir(src);
  filesToCompile = _.filter(files, (f) => f.endsWith('.wlt'));
}
else {
  filesToCompile = [src];
  src = path.dirname(src);
}

const generatedHeader = '// Generated from Willet source\n';

for (let i = 0; i < filesToCompile.length; i += 1) {
  const file = filesToCompile[i];
  const targetFile = path.join(process.cwd(), target,
    path.relative(src, file).replace(/\.wlt$/, '.js'));
  console.log(`Compiling ${file} to ${targetFile}`);
  const contents = fs.readFileSync(file).toString();
  try {
    const context = compiler.createContext(src);
    context.skipCore = skipCore;
    const jsContents = compiler.compile(context, contents);
    const dirName = path.dirname(targetFile);
    try {
      fs.mkdirSync(dirName, { recursive: true });
    }
    catch (err) {
      if (err.code !== 'EEXIST') { // curDir already exists!
        throw err;
      }
    }

    fs.writeFileSync(targetFile, `${generatedHeader}${jsContents}`);
  }
  catch (e) {
    console.log(e);
    throw e;
  }
}
