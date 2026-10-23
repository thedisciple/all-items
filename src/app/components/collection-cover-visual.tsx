import Image from "next/image";
import { LibraryBig } from "lucide-react";

export type CollectionVisualData = {
  id: string;
  icon: string | null;
  coverType: string | null;
  coverIcon: string | null;
  coverItemId: string | null;
  coverMediaId: string | null;
  coverUploadId: string | null;
};

export function CollectionCoverVisual({ collection, variant }: { collection: CollectionVisualData; variant: "card" | "detail" }) {
  const detail = variant === "detail";
  const imageClass = detail ? "collection-detail-cover" : "collection-card-image";
  const size = detail ? { width: 1200, height: 480 } : { width: 320, height: 200 };

  if (collection.coverType === "item_photo" && collection.coverItemId && collection.coverMediaId) {
    return <Image className={imageClass} src={`/media/${collection.coverItemId}/${collection.coverMediaId}?variant=${detail ? "image" : "thumbnail"}`} alt="" {...size} unoptimized/>;
  }
  if (collection.coverType === "upload" && collection.coverUploadId) {
    return <Image className={imageClass} src={`/media/collections/${collection.id}/${collection.coverUploadId}?variant=${detail ? "image" : "thumbnail"}`} alt="" {...size} unoptimized/>;
  }

  const emoji = collection.coverType === "emoji" ? collection.coverIcon : collection.icon;
  return <div className={detail ? "collection-detail-cover collection-detail-cover-placeholder" : "collection-card-placeholder"} aria-hidden="true">
    {emoji ? <span>{emoji}</span> : <LibraryBig size={detail ? 32 : 25}/>}
  </div>;
}
