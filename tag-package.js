'use strict';

const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { promisify } = require('util');
const _exec = promisify(cp.exec);
const writeFile = promisify(fs.writeFile);

const refType = process.env.REF_TYPE || 'tag';
const shouldOnlyRemove = !!process.env.REMOVE_ONLY;

async function exec(command, ...args) {
  let result = (await _exec(command, ...args)).stdout.trim();
  return result;
}

function generateString() {
  return Math.random().toString(36).substr(2);
}

async function getCheckedOutBranchName() {
  // "git branch" doesn't show orphaned branches
  let str = await exec('git symbolic-ref --short HEAD');

  return str.replace(/\r?\n/g, '');
}

async function tagPackage(packageDir, refName, siblingRefs) {
  let status = await exec('git status --porcelain');

  if (status && !shouldOnlyRemove) {
    throw new Error('Unsaved changes. Aborting.');
  }

  let tempBranch;
  if (refType === 'branch') {
    tempBranch = refName;
  } else {
    tempBranch = generateString();
  }

  let originalBranch = await getCheckedOutBranchName();

  let shouldDeleteOrphanBranch;
  let shouldCheckOutOriginalBranch;
  let shouldDiscardChanges;
  let shouldUnstageChanges;

  try {
    if (!shouldOnlyRemove) {
      await exec(`git checkout --orphan ${tempBranch}`);
      shouldCheckOutOriginalBranch = true;

      // everything is staged after the orphan call
      await exec('git rm -r --cached .');
      shouldDiscardChanges = true;

      let packageJson = require(path.join(process.cwd(), packageDir, 'package'));

      for (let type of [
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'devDependencies',
      ]) {
        for (let left in packageJson[type]) {
          for (let right in siblingRefs) {
            if (left === right) {
              packageJson[type][left] = siblingRefs[right];
            }
          }
        }
      }

      await writeFile(`${packageDir}/package.json`, JSON.stringify(packageJson, null, 2) + require('os').EOL);

      await exec(`git add ${packageDir}`);

      await exec('git clean -fdx');
      shouldDiscardChanges = false;

      await exec(`git mv ${packageDir}/* .`);
      shouldUnstageChanges = true;

      await exec(`git commit -m "${refName}"`);
      shouldDeleteOrphanBranch = true;
      shouldUnstageChanges = false;
    }

    if (refType === 'tag') {
      await exec(`git push origin :refs/tags/${refName}`);
      try {
        await exec(`git tag --delete ${refName}`);
      } catch (err) {
        if (!err.stderr.includes(`error: tag '${refName}' not found.`)) {
          throw err;
        }
      }

      if (!shouldOnlyRemove) {
        await exec(`git tag ${refName}`);
        await exec(`git push origin refs/tags/${refName}:refs/tags/${refName}`);
      }
    } else {
      await exec(`git push origin :refs/heads/${refName}`);

      if (!shouldOnlyRemove) {
        await exec(`git push origin refs/heads/${refName}:refs/heads/${refName}`);
      }
    }

    if (!shouldOnlyRemove) {
      await exec(`git checkout ${originalBranch}`);
      shouldCheckOutOriginalBranch = false;

      await exec(`git branch -D ${tempBranch}`);
      shouldDeleteOrphanBranch = false;
    }
  } catch (err) {
    if (shouldUnstageChanges) {
      await exec('git rm -r --cached .');
      shouldDiscardChanges = true;
    }

    if (shouldDiscardChanges) {
      await exec('git clean -fdx');
    }

    if (shouldCheckOutOriginalBranch) {
      await exec(`git checkout ${originalBranch}`);
    }

    if (shouldDeleteOrphanBranch) {
      await exec(`git branch -D ${tempBranch}`);
    }

    throw err;
  }
}

module.exports = tagPackage;
