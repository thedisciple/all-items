import Link from "next/link";

export function AppBrand({href,label}:{href:string;label:string}){
  return <Link className="brand" href={href} aria-label={label}><span className="brand-mark" aria-hidden="true">A</span><span className="brand-text">All Items</span></Link>;
}
