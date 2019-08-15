#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const lstat = promisify(fs.lstat);
const _exec = promisify(cp.exec);
const tagPackage = require('./tag-package');

const [, , packagesDirName = 'packages'] = process.argv;

async function exec(command, ...args) {
  let result = (await _exec(command, ...args)).stdout.trim();
  return result;
}

(async () => {
  let packageDirNames = await readdir(packagesDirName);

  let packages = [];
  let siblingRefs = {};

  for (let packageDirName of packageDirNames) {
    let packageDir = `${packagesDirName}/${packageDirName}`;
    let stats = await lstat(packageDir);
    if (!stats.isDirectory()) {
      continue;
    }

    let refName = packageDirName;

    packages.push({
      packageDir,
      refName,
    });

    let packageJson = require(path.join(process.cwd(), packageDir, 'package'));

    // let repositoryUrl = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository.url;
    let repositoryUrl = await exec('git config --get remote.origin.url');

    siblingRefs[packageJson.name] = `git+${repositoryUrl}#${refName}`;
  }

  for (let {
    packageDir,
    refName,
  } of packages) {
    await tagPackage(packageDir, refName, siblingRefs);
  }
})();

// https://medium.com/@dtinth/making-unhandled-promise-rejections-crash-the-node-js-process-ffc27cfcc9dd
process.on('unhandledRejection', up => { throw up; });
