#!/usr/bin/env node

import { createCliParser } from './cliParser';

const program = createCliParser();

program.parse(process.argv);
