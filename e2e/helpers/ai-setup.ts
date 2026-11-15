import setup from './auth-setup';
import type {FullConfig} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export default async function aiSetup(config:FullConfig){await setup(config);await promisify(execFile)(process.execPath,['--import','tsx','e2e/helpers/ai-seed.ts'],{env:{...process.env,ALL_ITEMS_DATA_DIR:process.env.ALL_ITEMS_E2E_ROOT},windowsHide:true});}
