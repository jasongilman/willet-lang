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
let ignorePaths;

program
  .version('0.0.1')
  .arguments('<source> <targetDir>')
  .option('-c, --skipcore', 'Skip including Willet Core')
  .option('-i, --ignore [paths...]', 'Specify paths to ignore during compilation')
  .action((source, targetDir, cmdObj) => {
    src = source;
    target = targetDir;
    skipCore = !!cmdObj.skipcore;
    ignorePaths = cmdObj.ignore;
  });

program.parse(process.argv);

if (typeof ignorePaths === 'undefined') {
  ignorePaths = [];
}
else if (!_.isArray(ignorePaths)) {
  ignorePaths = [ignorePaths];
}
// Make ignore paths aboslute
ignorePaths = _.map(ignorePaths, (p) => path.resolve(p));

if (typeof src === 'undefined') {
  fail('no source given');
}
if (typeof target === 'undefined') {
  fail('no target given');
}

if (!fs.existsSync(src)) {
  fail(`source [${src}] does not exist`);
}
else {
  // Make src an absolute path.
  src = path.resolve(src);
}

if (fs.existsSync(target)) {
  if (!fs.lstatSync(target).isDirectory()) {
    fail(`Target [${target}] is not a directory`);
  }
  // Make target an absolute path.
  target = path.resolve(target);
}
else {
  fail(`Target directory [${target}] does not exist`);
}

let filesToCompile;

if (fs.lstatSync(src).isDirectory()) {
  const files = readFilesFromDir(src);
  filesToCompile = _(files)
    .filter((f) => _.isEmpty(ignorePaths) ||
      !_.some(ignorePaths, (ignorePath) => f.startsWith(ignorePath)))
    .filter((f) => f.endsWith('.wlt'))
    .value();
}
else {
  filesToCompile = [src];
  src = path.dirname(src);
}

const generatedHeader = '// Generated from Willet source\n';

for (let i = 0; i < filesToCompile.length; i += 1) {
  const file = filesToCompile[i];
  const pathToSourceFile = path.relative(src, file);

  const targetFile = path.join(target, pathToSourceFile.replace(/\.wlt$/, '.js'));

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
