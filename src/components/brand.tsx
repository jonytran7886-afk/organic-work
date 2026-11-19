import Image from "next/image";
import Link from "next/link";
export function OrganicSymbol({ className = "" }: { className?: string }) {
  return (
    <Image
      className={"organic-symbol " + className}
      src="/brand/organicvn-symbol-color.svg"
      alt=""
      width={48}
      height={45}
      unoptimized
    />
  );
}
export function BrandLockup() {
  return (
    <Link href="/my-tasks" className="brand" aria-label="Organic Work">
      <span className="brand-symbol-shell">
        <OrganicSymbol />
      </span>
      <span className="brand-wordmark">
        Organic <b>Work</b>
        <small>KHÔNG GIAN LÀM VIỆC</small>
      </span>
    </Link>
  );
}
export function CorporateLogo() {
  return (
    <Image
      className="corporate-logo"
      src="/brand/organicvn-vertical-color.svg"
      alt="Organic Việt Nam"
      width={318}
      height={184}
      unoptimized
      preload
    />
  );
}
