#!/usr/bin/env node

const fs = require('fs');
const chevrotain = require('chevrotain');
const parser = require('../lib/chevrotain-parser');

const serializedGrammar = parser.parserInstance.getSerializedGastProductions();
const htmlText = chevrotain.createSyntaxDiagramsCode(serializedGrammar);
fs.writeFileSync('dist/grammar.html', htmlText);
