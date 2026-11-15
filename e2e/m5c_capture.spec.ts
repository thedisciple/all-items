import { test, expect } from './helpers/browser-reliability';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { messages, locales, type Locale } from '../src/i18n/messages';
import type { Page, Locator } from '@playwright/test';
test.use({ locale: 'en-US', reducedMotion: 'reduce', expectedResourceErrors: ['Failed to load resource: the server responded with a status of 409 (Conflict)', 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'] });
async function fixture() { return JSON.parse(await readFile(path.join(process.env.ALL_ITEMS_E2E_ROOT!, 'ai-fixture.json'), 'utf8')); }
async function counts() { const db = createClient({ url: pathToFileURL(path.join(process.env.ALL_ITEMS_E2E_ROOT!, 'all-items.db')).href }); try {
    const result = [];
    for (const table of ['items', 'media_assets', 'item_write_receipts'])
        result.push(Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]!.n));
    return result;
}
finally {
    db.close();
} }
async function photo(page: Page, dialog: Locator, color = 'green', locale:Locale='en') { await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 500, height: 350, channels: 3, background: color } }).png().toBuffer() }); const crop = page.getByRole('dialog', { name: messages[locale].cropTitle, exact: true }); await expect(crop.getByRole('button', { name: messages[locale].cropConfirm, exact: true })).toBeEnabled(); await crop.getByRole('button', { name: messages[locale].cropConfirm, exact: true }).click(); await expect(crop).not.toBeVisible(); }
for (const width of [360, 1365])
    test(`one accepted photo to reviewed draft to one save at ${width}px`, async ({ page }) => {
        test.setTimeout(120000);
        const f = await fixture();
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/inventories/${f.inventoryId}`);
        await page.getByRole('button', { name: messages.en.addItem, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: messages.en.addItem, exact: true });
        await dialog.locator('input[name="name"]').fill(`Human capture ${width}`);
        await dialog.locator('input[name="brand"]').fill('Human brand');
        let requests = 0;
        page.on('request', req => { if (req.url().endsWith('/identify-draft'))
            requests++; });
        await photo(page, dialog);
        expect(requests).toBe(0);
        const before = await counts();
        await dialog.getByRole('button', { name: messages.en.aiDraftIdentify, exact: true }).click();
        const review = dialog.locator('.draft-identification');
        await expect(review.getByText('No datasheet consulted')).toBeVisible();
        expect(await counts()).toEqual(before);
        await expect(review.getByLabel('Use: Name', { exact: true })).not.toBeChecked();
        await dialog.locator('input[name="model"]').fill('Later human edit');
        await expect(review.getByLabel('Use: Model', { exact: true })).not.toBeChecked();
        await review.getByLabel('Model', { exact: true }).fill('Reviewed capture model');
        await review.getByLabel('Model', { exact: true }).press('Enter');
        await expect(dialog).toBeVisible();expect(await counts()).toEqual(before);
        await review.getByLabel('Use: Model', { exact: true }).check();
        await review.getByRole('button', { name: messages.en.aiDraftUse, exact: true }).click();
        await expect(dialog.locator('input[name="model"]')).toHaveValue('Reviewed capture model');
        await expect(dialog.locator('input[name="name"]')).toHaveValue(`Human capture ${width}`);
        expect(await counts()).toEqual(before);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await dialog.screenshot({ path: path.join(process.env.ALL_ITEMS_E2E_ROOT!, `capture-${width}.png`) });
        await dialog.getByRole('button', { name: messages.en.saveItem, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByRole('link', { name: `Human capture ${width}`, exact: true })).toBeVisible();
        const after = await counts();
        expect(after[0]).toBe(before[0]! + 1);
        expect(after[1]).toBe(before[1]! + 1);
        await page.getByRole('link', { name: `Human capture ${width}`, exact: true }).click();
        await expect(page.getByRole('button', { name: messages.en.sourceTitle, exact: true })).toBeVisible();
        await expect(page.locator('input[name="model"]')).toHaveValue('Reviewed capture model');
    });
test('inline review fits five mobile locales with keyboard cancellation',async({browser,page})=>{
 test.setTimeout(120000);const f=await fixture(),errors:string[]=[];
 for(const locale of locales){const ctx=await browser.newContext({storageState:await page.context().storageState(),viewport:{width:360,height:800},reducedMotion:'reduce'});try{await ctx.addCookies([{name:'all-items-language',value:locale,url:'http://127.0.0.1:3100'}]);const view=await ctx.newPage();view.on('pageerror',error=>errors.push(error.message));view.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await view.goto(`/inventories/${f.inventoryId}`);await view.getByRole('button',{name:messages[locale].addItem,exact:true}).click();const dialog=view.getByRole('dialog',{name:messages[locale].addItem,exact:true});await photo(view,dialog,'green',locale);
 await view.route('**/identify-draft',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({requestId:route.request().headers()['x-all-items-ai-request'],suggestion:{version:1,name:'Synthetic proposed name',brand:'',model:'Synthetic model',description:'Synthetic description',categories:['tools'],visibleMarking:'Read only',uncertainty:'uncertain',uncertainties:['Synthetic ambiguous variant']}})}));await dialog.getByRole('button',{name:messages[locale].aiDraftIdentify,exact:true}).click();const review=dialog.locator('.draft-identification');await expect(review.getByText('Synthetic ambiguous variant')).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await view.screenshot({path:path.join(process.env.ALL_ITEMS_E2E_ROOT!,`capture-review-${locale}-360.png`)});await review.getByRole('button',{name:messages[locale].cancel,exact:true}).focus();await view.keyboard.press('Enter');await expect(review.getByRole('button',{name:messages[locale].aiDraftIdentify,exact:true})).toBeFocused();await expect(review.getByRole('button',{name:messages[locale].aiDraftUse,exact:true})).toHaveCount(0);
 }finally{await ctx.close();}}expect(errors).toEqual([]);
});
test('closed analysis cannot apply a late response and manual save remains available', async ({ page }) => {
    const f = await fixture();
    await page.goto(`/inventories/${f.inventoryId}`);
    await page.getByRole('button', { name: messages.en.addItem, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: messages.en.addItem, exact: true });
    await dialog.locator('input[name="name"]').fill('Keep human input');
    await photo(page, dialog);
    const before = await counts();
    let release!: () => void;
    const wait = new Promise<void>(resolve => release = resolve);
    let received!: () => void;
    const incoming = new Promise<void>(resolve => received = resolve);
    await page.route('**/identify-draft', async (route) => { received(); await wait; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'aiTimeout' }) }).catch(() => { }); });
    await dialog.getByRole('button', { name: messages.en.aiDraftIdentify, exact: true }).click();
    await incoming;
    await dialog.locator('.dialog-heading button').click();
    release();
    await page.getByRole('button', { name: messages.en.addItem, exact: true }).click();
    await expect(dialog.locator('input[name="name"]')).toHaveValue('Keep human input');
    await expect(dialog.getByRole('button', { name: messages.en.aiDraftUse, exact: true })).toHaveCount(0);
    expect(await counts()).toEqual(before);
    await expect(dialog.getByRole('button', { name: messages.en.saveItem, exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: messages.en.saveItem, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await counts())[0]).toBe(before[0]! + 1);
});
test('recropping invalidates analysis and timeout leaves manual creation usable', async ({ page }) => {
    const f = await fixture();
    await page.goto(`/inventories/${f.inventoryId}`);
    await page.getByRole('button', { name: messages.en.addItem, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: messages.en.addItem, exact: true });
    await dialog.locator('input[name="name"]').fill('Recrop human input');
    await photo(page, dialog);
    const before = await counts();
    let release!: () => void, received!: () => void;
    const wait = new Promise<void>(resolve => release = resolve), incoming = new Promise<void>(resolve => received = resolve);
    await page.route('**/identify-draft', async (route) => { received(); await wait; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'aiTimeout' }) }).catch(() => { }); });
    await dialog.getByRole('button', { name: messages.en.aiDraftIdentify, exact: true }).click();
    await incoming;
    await dialog.getByRole('button', { name: messages.en.editCrop, exact: true }).click();
    const crop = page.getByRole('dialog', { name: messages.en.cropTitle, exact: true });
    await expect(crop.getByRole('button', { name: messages.en.cropConfirm, exact: true })).toBeEnabled();
    await crop.getByRole('button', { name: messages.en.cropConfirm, exact: true }).click();
    await expect(crop).not.toBeVisible();
    release();
    await expect(dialog.getByRole('button', { name: messages.en.aiDraftUse, exact: true })).toHaveCount(0);
    await expect(dialog.locator('input[name="name"]')).toHaveValue('Recrop human input');
    expect(await counts()).toEqual(before);
    await dialog.getByRole('button', { name: messages.en.aiDraftIdentify, exact: true }).click();
    await expect(dialog.locator('.draft-identification').getByRole('alert')).toHaveText(messages.en.aiTimeout);
    await expect(dialog.getByRole('button', { name: messages.en.saveItem, exact: true })).toBeEnabled();
    expect(await counts()).toEqual(before);
});
test('source review binds active input to its revision and new reviews use refreshed identity', async ({ page, browser }) => {
    const f = await fixture(), url = `http://127.0.0.1:3100/inventories/${f.inventoryId}/items/${f.id}`;
    await page.goto(url);
    await page.getByRole('button', { name: messages.en.sourceTitle, exact: true }).click();
    const form = page.locator('.source-fields');
    async function fill(form: Locator, model: string) { for (const [label, value] of [[messages.en.sourceUrl, 'https://manufacturer.example/product'], [messages.en.sourceLabel, 'Synthetic official'], [messages.en.sourceMatch, 'Exact variant'], [messages.en.itemModel, model]])
        await form.getByLabel(label, { exact: true }).fill(value); await form.getByLabel(messages.en.sourceConfirm).check(); }
    await fill(form, 'Active unsaved model');
    const ctx = await browser.newContext({ storageState: await page.context().storageState(), locale: 'en-US' });
    try {
        const other = await ctx.newPage();
        await other.goto(url);
        await other.getByRole('button', { name: messages.en.sourceTitle, exact: true }).click();
        await fill(other.locator('.source-fields'), 'Fresh saved model');
        await other.locator('.source-fields').getByRole('button', { name: messages.en.saveChanges, exact: true }).click();
        await expect(other.locator('.source-review > p').getByText(messages.en.sourceRecorded, { exact: true })).toBeVisible();
        await form.getByRole('button', { name: messages.en.saveChanges, exact: true }).click();
        await expect(form.getByRole('alert')).toHaveText(messages.en.aiStale);
        await expect(form.getByLabel(messages.en.itemModel, { exact: true })).toHaveValue('Active unsaved model');
        await expect(page.locator('.source-review > p').getByText(messages.en.sourceRecorded, { exact: true })).toBeVisible();
        await form.getByRole('button', { name: messages.en.sourceRestart, exact: true }).click();
        await expect(form.getByLabel(messages.en.itemModel, { exact: true })).toHaveValue('Fresh saved model');
        await expect(form.getByLabel(messages.en.sourceConfirm)).not.toBeChecked();
        await form.getByRole('button', { name: messages.en.sourceRemove, exact: true }).click();
        await expect(form).not.toBeVisible();
        await page.getByRole('button', { name: messages.en.sourceTitle, exact: true }).click();
        await expect(form.getByLabel(messages.en.sourceUrl)).toHaveValue('');
        await expect(form.getByLabel(messages.en.sourceQuery)).toHaveValue(/Fresh saved model/);
    }
    finally {
        await ctx.close();
    }
});
