#!/usr/bin/env node
'use strict';
// Thin CJS wrapper -> ESM CLI (mirrors huaweicloud-devkit's bin/setup.cjs).
const path = require('node:path');
const fileUrl = require('node:url').pathToFileURL(
  path.join(__dirname, '..', 'src', 'setup-cli.mjs'),
).href;

import(fileUrl).catch((error) => {
  console.error(error.message);
  process.exit(1);
});