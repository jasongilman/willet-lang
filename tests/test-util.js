const fs = require('fs');
const childProcess = require('child_process');

const TEMP_FILE = 'tmp_file.txt';

const exec = (cmd) => {
  childProcess.exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
};

const copyText = (text) => {
  fs.writeFileSync(TEMP_FILE, text);
  exec(`cat ${TEMP_FILE} | pbcopy`);
  fs.unlinkSync(TEMP_FILE);
};

const openTextInAtom = (fileName, text) => {
  fs.writeFileSync(fileName, text);
  exec(`atom ${fileName}`);
};

const saveText = (fileName, text) => {
  fs.writeFileSync(fileName, text);
};

module.exports = {
  copyText,
  openTextInAtom,
  saveText
};
