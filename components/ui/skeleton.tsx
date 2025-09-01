"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean;
  children?: React.ReactNode;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, isLoading = true, children, ...props }, ref) => {
    if (!isLoading) {
      return <>{children}</>;
    }

    return (
      <div
        ref={ref}
        className={cn("animate-pulse rounded-md bg-muted", className)}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

const CardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-col space-y-3", className)}>
    <Skeleton className="h-32 rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-4" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  </div>
);

const TextSkeleton = ({ className, lines = 3 }: { className?: string; lines?: number }) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-3/4' : ''}`} />
    ))}
  </div>
);

const AvatarSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn("h-10 w-10 rounded-full", className)} />
);

const ButtonSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn("h-10 w-24 rounded-md", className)} />
);

export { Skeleton, CardSkeleton, TextSkeleton, AvatarSkeleton, ButtonSkeleton };