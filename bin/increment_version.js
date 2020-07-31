// #!/usr/bin/env node

const fs = require('fs');

const packageFile = `${__dirname}/../package.json`;

const contents = JSON.parse(fs.readFileSync(packageFile).toString());

const versionRegex = /^(0.0.1\-alpha)(\d+)$/;

const [, beforeVersion, version] = versionRegex.exec(contents.version);
const incremented = parseInt(version, 10) + 1;

contents.version = `${beforeVersion}${incremented}`;

fs.writeFileSync(packageFile, JSON.stringify(contents, null, 2));

console.log('Wrote out new version in package.json', contents.version);
