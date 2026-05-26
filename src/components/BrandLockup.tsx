import { cn } from "../lib/utils";
import { publicAssetPath } from "../lib/assets";

export const APP_NAME = "NotaryXpert";
export const APP_LOGO_SRC = publicAssetPath("Notary-removebg-preview.png");

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
}

export function BrandMark({ className, imageClassName }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 ring-1 ring-orange-200/80 shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <img
        src={APP_LOGO_SRC}
        alt=""
        draggable={false}
        className={cn("h-full w-full scale-[1.85] select-none object-contain", imageClassName)}
      />
    </span>
  );
}

interface BrandLockupProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export function BrandLockup({
  className,
  markClassName,
  textClassName,
  subtitle,
  subtitleClassName,
}: BrandLockupProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)} aria-label={APP_NAME}>
      <BrandMark className={cn("h-10 w-10", markClassName)} />
      <div className="min-w-0">
        <span
          className={cn(
            "block truncate font-headline text-lg font-bold leading-none tracking-[-0.03em] text-on-surface",
            textClassName,
          )}
        >
          {APP_NAME}
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-1 block truncate font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant",
              subtitleClassName,
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
