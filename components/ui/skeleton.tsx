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

const ListItemSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-between p-4 rounded-lg border border-gray-800", className)}>
    <div className="flex items-center gap-4 flex-1">
      <AvatarSkeleton />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <ButtonSkeleton />
  </div>
);

const TableRowSkeleton = ({ columns = 4, className }: { columns?: number; className?: string }) => (
  <tr className={className}>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

const PageSkeleton = () => (
  <div className="container mx-auto px-4 py-8 space-y-8">
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export { 
  Skeleton, 
  CardSkeleton, 
  TextSkeleton, 
  AvatarSkeleton, 
  ButtonSkeleton,
  ListItemSkeleton,
  TableRowSkeleton,
  PageSkeleton
};