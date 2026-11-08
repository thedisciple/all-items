import {test,expect} from "./helpers/browser-reliability";
import {expectPageFits} from "./helpers/layout-gate";
import {messages} from "../src/i18n/messages";

test("installation backup is verified before success and can be rechecked on the private Data page",async({page})=>{
  test.setTimeout(180_000);await page.setViewportSize({width:360,height:820});await page.goto('/inventories/00000000-0000-4000-8000-000000000001/data');
  const section=page.locator('section').filter({has:page.locator('#installation-backups-title')}).last();
  await section.getByRole('button',{name:messages.ru.installationBackupCreate,exact:true}).click();await expect(section.getByRole('status')).toHaveText(messages.ru.installationBackupSuccess,{timeout:120_000});
  await expect(section).toContainText(messages.ru.installationBackupNotRechecked);
  await section.getByRole('button',{name:messages.ru.installationBackupVerify,exact:true}).click();await expect(section.getByRole('status')).toHaveText(messages.ru.installationBackupSuccess,{timeout:120_000});await expectPageFits(page);
  await page.reload();await expect(section).toContainText(messages.ru.installationBackupNotRechecked);await expect(section.getByRole('status')).toHaveCount(0);
});
