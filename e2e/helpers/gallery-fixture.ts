import {createHash,randomUUID} from "node:crypto";
import {unzipSync,zipSync} from "fflate";
import {itemArchivePaths,readInventoryArchive,verifyInventoryArchive} from "../../src/export/archive";
import type {PortableInventory} from "../../src/export/import";

// Derive an owned synthetic fixture from a real exporter result, without a test-only server API.
export function galleryFixture(input:Uint8Array,name:string,count:number){
  const original=unzipSync(input),read=readInventoryArchive(input);
  const inventory=structuredClone(read.inventory) as PortableInventory;
  const item=inventory.items.find(item=>item.name===name)!;
  const template=item.mediaAssets[0]!;
  const bytes={image:original[template.imagePath]!,thumbnail:original[template.thumbnailPath]!,source:template.sourcePath?original[template.sourcePath]!:null};
  inventory.items=[item];inventory.collections=[];inventory.memberships=[];item.collectionIds=[];
  inventory.locations=inventory.locations.filter(location=>item.stock.some(stock=>stock.location_id===location.id));
  const files:Record<string,Uint8Array>={"README.txt":original["README.txt"]!};
  item.mediaAssets=Array.from({length:count},(_,index)=>{
    const paths=itemArchivePaths(item,{},index,count),id=randomUUID();
    files[paths.imagePath]=bytes.image;files[paths.thumbnailPath]=bytes.thumbnail;if(bytes.source)files[paths.sourcePath]=bytes.source;
    return {...template,id,isPrimary:index===Math.min(1,count-1),displayOrder:index,imagePath:paths.imagePath,thumbnailPath:paths.thumbnailPath,sourcePath:bytes.source?paths.sourcePath:null};
  });
  item.primaryMediaId=item.mediaAssets.find(photo=>photo.isPrimary)!.id;
  files["inventory.json"]=Buffer.from(JSON.stringify(inventory));
  const entries=Object.entries(files).map(([path,bytes])=>({path,size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}));
  files["manifest.json"]=Buffer.from(JSON.stringify({...read.manifest,entries}));
  files["checksums.sha256"]=Buffer.from(entries.map(entry=>entry.sha256+"  "+entry.path).join("\n")+"\n");
  const archive=zipSync(files,{level:0});verifyInventoryArchive(archive);return archive;
}
