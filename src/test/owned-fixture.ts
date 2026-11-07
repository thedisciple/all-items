import type {Client} from "@libsql/client";
export async function ownFixtureInventory(client:Pick<Client,"execute">,id:string){await client.execute({sql:"INSERT INTO inventory_owners(workspace_id,user_id) VALUES(?,'00000000-0000-4000-8000-000000000010')",args:[id]});}
